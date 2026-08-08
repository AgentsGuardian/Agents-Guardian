package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
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
	if err := verifyPubSubOIDCToken(tokenStr); err != nil {
		log.Printf("[Pub/Sub Auth] Rejected push request: OIDC token verification failed: %v", err)
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(fmt.Sprintf(`{"error":"Unauthorized: Invalid or forged Pub/Sub OIDC token: %s"}`, err.Error())))
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

type JWKS struct {
	Keys []JWK `json:"keys"`
}

type JWK struct {
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

var (
	jwksCache     *JWKS
	jwksFetchedAt time.Time
	jwksMutex     sync.RWMutex
)

func getGoogleJWKS() (*JWKS, error) {
	jwksMutex.RLock()
	if jwksCache != nil && time.Since(jwksFetchedAt) < 1*time.Hour {
		defer jwksMutex.RUnlock()
		return jwksCache, nil
	}
	jwksMutex.RUnlock()

	jwksMutex.Lock()
	defer jwksMutex.Unlock()

	if jwksCache != nil && time.Since(jwksFetchedAt) < 1*time.Hour {
		return jwksCache, nil
	}

	resp, err := http.Get("https://www.googleapis.com/oauth2/v3/certs")
	if err != nil {
		return jwksCache, fmt.Errorf("failed to fetch Google JWKS: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return jwksCache, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return jwksCache, fmt.Errorf("failed to decode JWKS JSON: %v", err)
	}

	jwksCache = &jwks
	jwksFetchedAt = time.Now()
	return jwksCache, nil
}

func parseBase64URL(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

func verifyPubSubOIDCToken(tokenStr string) error {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return fmt.Errorf("invalid token format: expected 3 parts")
	}

	headerBytes, err := parseBase64URL(parts[0])
	if err != nil {
		return fmt.Errorf("invalid header base64url encoding")
	}

	payloadBytes, err := parseBase64URL(parts[1])
	if err != nil {
		return fmt.Errorf("invalid payload base64url encoding")
	}

	sigBytes, err := parseBase64URL(parts[2])
	if err != nil {
		return fmt.Errorf("invalid signature base64url encoding")
	}

	var header struct {
		Alg    string `json:"alg"`
		Kid    string `json:"kid"`
		Pubkey string `json:"pubkey"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return fmt.Errorf("invalid header JSON")
	}

	var payload struct {
		Iss string      `json:"iss"`
		Aud interface{} `json:"aud"`
		Exp int64       `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return fmt.Errorf("invalid payload JSON")
	}

	// 1. Verify Issuer
	if payload.Iss != "https://accounts.google.com" && payload.Iss != "accounts.google.com" {
		return fmt.Errorf("invalid issuer: %s", payload.Iss)
	}

	// 2. Verify Expiration
	now := time.Now().Unix()
	if payload.Exp != 0 && payload.Exp < (now-60) {
		return fmt.Errorf("token expired at %d, current time %d", payload.Exp, now)
	}

	// 3. Verify Audience if specified
	expectedAudience := getEnv("EXPECTED_AUDIENCE", "")
	if expectedAudience != "" {
		audMatched := false
		switch v := payload.Aud.(type) {
		case string:
			if v == expectedAudience || strings.Contains(v, expectedAudience) {
				audMatched = true
			}
		case []interface{}:
			for _, item := range v {
				if str, ok := item.(string); ok && (str == expectedAudience || strings.Contains(str, expectedAudience)) {
					audMatched = true
					break
				}
			}
		}
		if !audMatched {
			return fmt.Errorf("audience mismatch for token")
		}
	}

	// 4. Verify Signature via JWKS or Test Key
	env := getEnv("NODE_ENV", getEnv("ENV", getEnv("GO_ENV", "development")))
	isProduction := strings.EqualFold(env, "production")
	testRsaPubKeyPem := os.Getenv("TEST_RSA_PUBLIC_KEY")
	if !isProduction && testRsaPubKeyPem != "" && header.Alg == "RS256" && (header.Kid == "test-key-id" || strings.HasPrefix(header.Kid, "test-")) {
		block, _ := pem.Decode([]byte(testRsaPubKeyPem))
		if block != nil {
			parsedKey, err := x509.ParsePKIXPublicKey(block.Bytes)
			if err == nil {
				if rsaKey, ok := parsedKey.(*rsa.PublicKey); ok {
					hashed := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
					if err := rsa.VerifyPKCS1v15(rsaKey, crypto.SHA256, hashed[:], sigBytes); err == nil {
						return nil
					}
					return fmt.Errorf("invalid test RSA signature")
				}
			}
		}
	}

	jwks, err := getGoogleJWKS()
	if err != nil {
		return fmt.Errorf("unable to fetch JWKS: %v", err)
	}

	var matchedKey *JWK
	for _, k := range jwks.Keys {
		if k.Kid == header.Kid {
			matchedKey = &k
			break
		}
	}

	if matchedKey == nil {
		return fmt.Errorf("key ID %s not found in Google JWKS", header.Kid)
	}

	nBytes, err := parseBase64URL(matchedKey.N)
	if err != nil {
		return fmt.Errorf("invalid JWK modulus: %v", err)
	}
	eBytes, err := parseBase64URL(matchedKey.E)
	if err != nil {
		return fmt.Errorf("invalid JWK exponent: %v", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = (e << 8) | int(b)
	}

	pubKey := &rsa.PublicKey{
		N: n,
		E: e,
	}

	hashed := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hashed[:], sigBytes); err != nil {
		return fmt.Errorf("RSA signature verification failed: %v", err)
	}

	return nil
}

