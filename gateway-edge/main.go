package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/pubsub"
	"github.com/go-redis/redis/v8"
	"github.com/open-policy-agent/opa/rego"
)

// InterceptRequest defines the payload structure received from AI agents
type InterceptRequest struct {
	TenantID   string `json:"tenant_id"`
	AgentID    string `json:"agent_id"`
	AgentName  string `json:"agent_name"`
	Action     string `json:"action"`
	Endpoint   string `json:"endpoint"`
	SessionID  string `json:"session_id"`
	CostEstUSD float64 `json:"cost_est_usd"`
}

// InterceptResponse represents Tier 1 pre-action authorization
type InterceptResponse struct {
	ID             string `json:"id"`
	Status         string `json:"status"` // AUTHORIZED | HALTED
	Authorized     bool   `json:"authorized"`
	PolicyViolated string `json:"policy_violated,omitempty"`
	LatencyMs      int64  `json:"latency_ms"`
	LedgerHash     string `json:"ledger_hash,omitempty"`
	Reason         string `json:"reason,omitempty"`
}

var (
	redisClient *redis.Client
	pubsubTopic *pubsub.Topic
	opaQuery    rego.PreparedEvalQuery
)

func main() {
	ctx := context.Background()

	// Initialize Redis Connection (Tier 1 Cache)
	redisHost := getEnv("REDIS_HOST", "localhost:6379")
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// Prepare Embedded Open Policy Agent (OPA) Rule Engine
	query, err := rego.New(
		rego.Query("data.agentsguardian.authz.allow"),
		rego.Module("authz.rego", `
			package agentsguardian.authz
			default allow = true

			# Block unauthorized database mutations from non-human agents
			allow = false {
				contains(lower(input.action), "drop table")
			}
			allow = false {
				contains(lower(input.action), "delete from")
			}
		`),
	).PrepareForEval(ctx)

	if err != nil {
		log.Fatalf("Failed to initialize OPA engine: %v", err)
	}
	opaQuery = query

	// Initialize GCP Pub/Sub Publisher for Async Tier 2 & Ledger
	projectID := getEnv("GCP_PROJECT_ID", "agentsguardian-prod")
	pubsubClient, err := pubsub.NewClient(ctx, projectID)
	if err == nil {
		topicID := getEnv("PUBSUB_TOPIC_ID", "agentsguardian-intercept-events")
		pubsubTopic = pubsubClient.Topic(topicID)
	} else {
		log.Printf("Warning: Pub/Sub client offline, running in standalone mode: %v", err)
	}

	http.HandleFunc("/api/v1/intercept", handleIntercept)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := getEnv("PORT", "8080")
	log.Printf("AgentsGuardian Gateway Edge listening on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func handleIntercept(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	w.Header().Set("Content-Type", "application/json")

	var req InterceptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.TenantID == "" {
		req.TenantID = "tenant_default"
	}

	// 1. Tier 1 OPA Policy Evaluation (<10ms SLA)
	ctx := r.Context()
	results, err := opaQuery.Eval(ctx, rego.EvalInput(map[string]interface{}{
		"action":   req.Action,
		"agent_id": req.AgentID,
	}))

	authorized := false
	if err == nil && len(results) > 0 {
		if allowed, ok := results[0].Expressions[0].Value.(bool); ok {
			authorized = allowed
		}
	}

	latencyMs := time.Since(startTime).Milliseconds()
	if latencyMs == 0 {
		latencyMs = 1
	}

	reqID := fmt.Sprintf("KG-%d", time.Now().UnixNano()/1e6)

	if !authorized {
		resp := InterceptResponse{
			ID:             reqID,
			Status:         "HALTED",
			Authorized:     false,
			PolicyViolated: "POL-SEC-01",
			LatencyMs:      latencyMs,
			Reason:         "Action matches forbidden non-human identity boundary constraint (e.g., destructive SQL mutation).",
		}

		// Dispatch async event to Pub/Sub for ledger writer
		dispatchPubSubEvent(req, "HALTED", "POL-SEC-01")

		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 2. Budget Check via Redis Atomic Key
	budgetKey := fmt.Sprintf("tenant:%s:agent:%s:budget", req.TenantID, req.AgentID)
	currentSpend, _ := redisClient.Get(ctx, budgetKey).Float64()
	if currentSpend+req.CostEstUSD > 50.0 {
		resp := InterceptResponse{
			ID:             reqID,
			Status:         "HALTED",
			Authorized:     false,
			PolicyViolated: "POL-FIN-01",
			LatencyMs:      latencyMs,
			Reason:         "Agent session budget cap of $50.00 exceeded.",
		}
		dispatchPubSubEvent(req, "HALTED", "POL-FIN-01")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// Increment Redis budget
	redisClient.IncrByFloat(ctx, budgetKey, req.CostEstUSD)

	resp := InterceptResponse{
		ID:         reqID,
		Status:     "AUTHORIZED",
		Authorized: true,
		LatencyMs:  latencyMs,
	}

	dispatchPubSubEvent(req, "AUTHORIZED", "")

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func dispatchPubSubEvent(req InterceptRequest, status, policyViolated string) {
	if pubsubTopic == nil {
		return
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"tenant_id":       req.TenantID,
		"agent_id":        req.AgentID,
		"agent_name":      req.AgentName,
		"action":          req.Action,
		"status":          status,
		"policy_violated": policyViolated,
		"timestamp":       time.Now().Format(time.RFC3339),
	})

	pubsubTopic.Publish(context.Background(), &pubsub.Message{
		Data: payload,
	})
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
