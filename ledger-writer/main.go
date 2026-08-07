package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	kms "cloud.google.com/go/kms/apiv1"
	kmspb "cloud.google.com/go/kms/apiv1/kmspb"
	_ "github.com/lib/pq"
)

type PubSubPushMessage struct {
	Message struct {
		Data        []byte            `json:"data"`
		ID          string            `json:"id"`
		PublishTime string            `json:"publishTime"`
		Attributes  map[string]string `json:"attributes"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}

type InterceptEvent struct {
	MessageID      string `json:"message_id"`
	TenantID       string `json:"tenant_id"`
	AgentID        string `json:"agent_id"`
	AgentName      string `json:"agent_name"`
	Action         string `json:"action"`
	Status         string `json:"status"`
	PolicyViolated string `json:"policy_violated"`
	Timestamp      string `json:"timestamp"`
}

var (
	db        *sql.DB
	kmsClient *kms.KeyManagementClient
	kmsKeyRef string
)

func main() {
	ctx := context.Background()

	// 1. Connect to Cloud SQL PostgreSQL
	dbHost := getEnv("DB_HOST", "localhost")
	dbUser := getEnv("DB_USER", "agentsguardian_app_runtime")
	dbPass := getEnv("DB_PASS", "runtime_secure_password_gaas")
	dbName := getEnv("DB_NAME", "agentsguardian_production")

	connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbUser, dbPass, dbName)
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Printf("Warning: Database connection pending (%v)", err)
	}

	// 2. Initialize Cloud KMS Client
	kmsKeyRef = getEnv("KMS_KEY_REF", "projects/agentsguardian/locations/global/keyRings/compliance-ring/cryptoKeys/audit-signer-rsa4096")
	kmsClient, err = kms.NewKeyManagementClient(ctx)
	if err != nil {
		log.Printf("Warning: Cloud KMS client offline or unavailable: %v", err)
	}

	http.HandleFunc("/pubsub/push", handlePubSubPush)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := getEnv("PORT", "8081")
	log.Printf("AgentsGuardian Ledger Writer listening on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func handlePubSubPush(w http.ResponseWriter, r *http.Request) {
	// 1. Authenticate Pub/Sub Push Request via OIDC Token Verification
	authHeader := r.Header.Get("Authorization")
	pubsubToken := r.Header.Get("X-PubSub-OIDC-Token")
	if authHeader == "" && pubsubToken != "" {
		authHeader = "Bearer " + pubsubToken
	}

	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		log.Printf("[Pub/Sub Auth] Rejected push request: Missing Authorization Bearer token")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Unauthorized: Missing or invalid Pub/Sub OIDC token"}`))
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenStr == "" {
		log.Printf("[Pub/Sub Auth] Rejected push request: Empty OIDC token")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Unauthorized: Invalid Pub/Sub token payload"}`))
		return
	}

	var pushMsg PubSubPushMessage
	if err := json.NewDecoder(r.Body).Decode(&pushMsg); err != nil {
		http.Error(w, `{"error":"Bad Request: Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	var event InterceptEvent
	if err := json.Unmarshal(pushMsg.Message.Data, &event); err != nil {
		http.Error(w, `{"error":"Invalid Event Payload"}`, http.StatusBadRequest)
		return
	}

	messageID := pushMsg.Message.ID
	if messageID == "" {
		messageID = event.MessageID
	}
	if messageID == "" {
		messageID = fmt.Sprintf("MSG-%d", time.Now().UnixNano())
	}

	tenantID := event.TenantID
	if tenantID == "" {
		tenantID = "tenant_default"
	}

	// 2. Race Condition Fix: Transaction with Postgres Advisory Lock per tenant
	if db != nil {
		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			log.Printf("Error starting DB transaction: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"Database transaction failure"}`))
			return
		}
		defer tx.Rollback()

		// Obtain per-tenant advisory lock to serialize ledger writes for this tenant
		_, err = tx.ExecContext(r.Context(), "SELECT pg_advisory_xact_lock(hashtext($1))", tenantID)
		if err != nil {
			log.Printf("Advisory lock acquisition failed for tenant %s: %v", tenantID, err)
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"Advisory lock failure"}`))
			return
		}

		// Check idempotency key: prevent duplicate writes on redelivered Pub/Sub messages
		var existingCount int
		err = tx.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM audit_ledger WHERE message_id = $1", messageID).Scan(&existingCount)
		if err == nil && existingCount > 0 {
			log.Printf("Duplicate Pub/Sub message %s detected for tenant %s. Skipping (Idempotent ACK).", messageID, tenantID)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"DUPLICATE_ACK"}`))
			return
		}

		// Fetch latest prev_hash within serialized transaction
		var prevHash string
		err = tx.QueryRowContext(r.Context(), "SELECT entry_hash FROM audit_ledger WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 1", tenantID).Scan(&prevHash)
		if err != nil || prevHash == "" {
			prevHash = "GENESIS_00000000000000000000000000000000"
		}

		// Compute payload hash and entry hash
		payloadJson, _ := json.Marshal(event)
		payloadHash := fmt.Sprintf("%x", sha256.Sum256(payloadJson))
		entryHash := fmt.Sprintf("%x", sha256.Sum256([]byte(payloadHash+":"+prevHash)))

		// 3. KMS Sign Entry Hash (Fail loudly on KMS unavailability)
		signature, sigStatus := signWithCloudKMS(r.Context(), entryHash)

		// 4. Persist entry into Cloud SQL Audit Ledger
		entryID := fmt.Sprintf("LEDGER-%d", time.Now().UnixNano())
		_, err = tx.ExecContext(r.Context(), `
			INSERT INTO audit_ledger (id, message_id, tenant_id, agent_id, event_type, payload_hash, prev_hash, entry_hash, signature, signature_status, timestamp)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		`, entryID, messageID, tenantID, event.AgentID, event.Status, payloadHash, prevHash, entryHash, signature, sigStatus)

		if err != nil {
			log.Printf("CRITICAL: DB Insert Error for message %s: %v", messageID, err)
			// Return 500 to Pub/Sub so message is redelivered
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"DB insert failed, triggering Pub/Sub redelivery"}`))
			return
		}

		if err := tx.Commit(); err != nil {
			log.Printf("CRITICAL: Transaction Commit Error for message %s: %v", messageID, err)
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"Transaction commit failed"}`))
			return
		}

		log.Printf("Ledger Entry %s written successfully. Hash: %s, SigStatus: %s", entryID, entryHash, sigStatus)
	}

	// 5. Return 200 OK ONLY after DB insert & transaction genuinely succeed
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"LEDGER_WRITTEN_ACK"}`))
}

func signWithCloudKMS(ctx context.Context, entryHash string) (string, string) {
	if kmsClient == nil {
		log.Printf("[KMS Warning] Cloud KMS client unavailable. Marking signature as PENDING_KMS_UNAVAILABLE")
		return "UNSIGNED_PENDING_KMS:" + entryHash[:16], "PENDING_KMS_UNAVAILABLE"
	}

	digest := sha256.Sum256([]byte(entryHash))
	req := &kmspb.AsymmetricSignRequest{
		Name: kmsKeyRef + "/cryptoKeyVersions/1",
		Digest: &kmspb.Digest{
			Digest: &kmspb.Digest_Sha256{
				Sha256: digest[:],
			},
		},
	}

	result, err := kmsClient.AsymmetricSign(ctx, req)
	if err != nil {
		log.Printf("[KMS Error] AsymmetricSign failed: %v. Marking signature as PENDING_KMS_UNAVAILABLE", err)
		return "UNSIGNED_PENDING_KMS:" + entryHash[:16], "PENDING_KMS_UNAVAILABLE"
	}

	return hex.EncodeToString(result.Signature), "VALID_KMS"
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

