package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/pubsub"
	"github.com/go-redis/redis/v8"
	"github.com/open-policy-agent/opa/rego"
)

// InterceptRequest defines the payload structure received from AI agents or Node BFF
type InterceptRequest struct {
	TenantID   string                 `json:"tenant_id"`
	AgentID    string                 `json:"agent_id"`
	AgentName  string                 `json:"agent_name"`
	Action     string                 `json:"action"`
	Endpoint   string                 `json:"endpoint"`
	SessionID  string                 `json:"session_id"`
	CostEstUSD float64                `json:"cost_est_usd"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
	PromptText string                 `json:"prompt_text,omitempty"`
}

// InterceptResponse represents canonical authoritative pre-action authorization
type InterceptResponse struct {
	ID             string  `json:"id"`
	TenantID       string  `json:"tenant_id,omitempty"`
	Status         string  `json:"status"` // AUTHORIZED | HALTED
	Authorized     bool    `json:"authorized"`
	PolicyViolated string  `json:"policy_violated,omitempty"`
	LatencyMs      int64   `json:"latency_ms"`
	VerifiedCost   float64 `json:"verified_cost_usd,omitempty"`
	LedgerHash     string  `json:"ledger_hash,omitempty"`
	Reason         string  `json:"reason,omitempty"`
}

// SemanticScanResult represents Tier 2 Gemini / semantic analysis result
type SemanticScanResult struct {
	ActionType        string  `json:"actionType"`
	IsPromptInjection bool    `json:"isPromptInjection"`
	ContainsSecrets   bool    `json:"containsSecrets"`
	DriftScore        float64 `json:"driftScore"`
	RiskLevel         string  `json:"riskLevel"`
	Recommendation    string  `json:"recommendation"`
	Reason            string  `json:"reason"`
}

var (
	redisClient     *redis.Client
	pubsubTopic     *pubsub.Topic
	opaQuery        rego.PreparedEvalQuery
	memBudgets      = make(map[string]float64)
	memBudgetsMutex sync.Mutex

	// Atomic Redis Lua script for check-and-increment budget reservation
	budgetLuaScript = redis.NewScript(`
		local key = KEYS[1]
		local cost = tonumber(ARGV[1])
		local cap = tonumber(ARGV[2])
		local current = tonumber(redis.call('GET', key) or "0")
		if current + cost > cap then
			return {0, tostring(current)}
		else
			local new_spend = redis.call('INCRBYFLOAT', key, cost)
			return {1, tostring(new_spend)}
		end
	`)
)

func main() {
	ctx := context.Background()

	// Enforce required INTERNAL_SERVICE_SECRET
	if strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_SECRET")) == "" {
		log.Fatalf("FATAL: INTERNAL_SERVICE_SECRET environment variable is required and must be set")
	}

	// Initialize Redis Connection (Tier 1 Cache)
	redisHost := getEnv("REDIS_HOST", "localhost:6379")
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// Prepare Embedded Open Policy Agent (OPA) Rule Engine with Structured Rules
	query, err := rego.New(
		rego.Query("data.agentsguardian.authz.allow"),
		rego.Module("authz.rego", `
			package agentsguardian.authz
			default allow = true

			# Deny unauthorized database mutations from non-human agents
			allow = false {
				input.action_type == "db.write"
				not input.has_erp_context
			}

			# Deny raw shell execution
			allow = false {
				input.action_type == "shell.exec"
			}

			# Deny bulk file deletion
			allow = false {
				input.action_type == "file.delete"
			}

			# Deny budget bypass attempt where client claimed $0 on non-empty request
			allow = false {
				input.cost_bypass_attempt == true
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
	http.HandleFunc("/v1/intercept", handleIntercept)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := getEnv("PORT", "8081")
	log.Printf("AgentsGuardian Gateway Edge listening on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func hashTenantApiKey(rawKey string) string {
	h := sha256.Sum256([]byte(strings.TrimSpace(rawKey)))
	return hex.EncodeToString(h[:])
}

func validateApiKey(ctx context.Context, apiKey string) (string, bool) {
	cleanKey := strings.TrimSpace(apiKey)
	if cleanKey == "" {
		return "", false
	}

	keyHash := hashTenantApiKey(cleanKey)

	// 1. Check Redis Cache
	if redisClient != nil {
		cacheKey := fmt.Sprintf("tenant_key:%s", keyHash)
		cachedTenantID, err := redisClient.Get(ctx, cacheKey).Result()
		if err == nil {
			if cachedTenantID == "INVALID" {
				return "", false
			}
			if cachedTenantID != "" {
				return cachedTenantID, true
			}
		}
	}

	// 2. Query Node / Admin Service Validation Endpoint
	nodeServiceURL := getEnv("NODE_SERVICE_URL", "http://localhost:3000")
	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")
	valReqBody, _ := json.Marshal(map[string]string{"apiKey": cleanKey})
	httpReq, err := http.NewRequestWithContext(ctx, "POST", nodeServiceURL+"/api/v1/tenant-keys/validate", strings.NewReader(string(valReqBody)))
	if err == nil {
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Internal-Service-Key", internalSecret)
		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var valResult struct {
					Valid    bool   `json:"valid"`
					TenantID string `json:"tenantId"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&valResult); err == nil && valResult.Valid && valResult.TenantID != "" {
					if redisClient != nil {
						redisClient.Set(ctx, fmt.Sprintf("tenant_key:%s", keyHash), valResult.TenantID, 5*time.Minute)
					}
					return valResult.TenantID, true
				}
			}
		}
	}

	// Unrecognized key -> cache negative result short TTL
	if redisClient != nil {
		redisClient.Set(ctx, fmt.Sprintf("tenant_key:%s", keyHash), "INVALID", 30*time.Second)
	}

	return "", false
}

func localSecurityScan(text string) (bool, bool) {
	lower := strings.ToLower(text)

	// Prompt injection detection patterns
	isInjection := false
	injectionKeywords := []string{
		"ignore all previous",
		"ignore prior",
		"system prompt override",
		"dan mode",
		"jailbreak",
		"bypass security",
		"bypass policy",
		"bypass governance",
		"disregard safety",
		"override guardrails",
		"you are now unrestricted",
		"developer mode enabled",
	}
	for _, kw := range injectionKeywords {
		if strings.Contains(lower, kw) {
			isInjection = true
			break
		}
	}

	// Secret detection signatures
	hasSecrets := false
	secretSignatures := []string{
		"aizasy",
		"sk_live_",
		"ghp_",
		"github_pat_",
		"-----begin rsa private key-----",
		"-----begin private key-----",
		"postgres://",
		"mysql://",
		"redis://",
	}
	for _, sig := range secretSignatures {
		if strings.Contains(lower, sig) {
			hasSecrets = true
			break
		}
	}

	return isInjection, hasSecrets
}

func queryTier2SemanticScan(ctx context.Context, req InterceptRequest) (*SemanticScanResult, error) {
	nodeServiceURL := getEnv("NODE_SERVICE_URL", "http://localhost:3000")
	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")

	scanPayload, _ := json.Marshal(map[string]interface{}{
		"agentId":       req.AgentID,
		"agentName":     req.AgentName,
		"actionCommand": req.Action,
		"endpoint":      req.Endpoint,
		"promptText":    req.PromptText,
		"rawJsonIntent": req.PromptText,
		"parameters":    req.Parameters,
		"tenantId":      req.TenantID,
	})

	httpReq, err := http.NewRequestWithContext(ctx, "POST", nodeServiceURL+"/api/v1/internal/semantic-scan", strings.NewReader(string(scanPayload)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-Service-Key", internalSecret)

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("semantic scan returned HTTP %d", resp.StatusCode)
	}

	var result SemanticScanResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func handleIntercept(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	w.Header().Set("Content-Type", "application/json")

	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")
	incomingInternalKey := r.Header.Get("X-Internal-Service-Key")

	var resolvedTenantID string
	var isAuthenticated bool

	// 0. Authentication: either trusted internal service call OR external API key
	if incomingInternalKey != "" && incomingInternalKey == internalSecret {
		isAuthenticated = true
	} else {
		apiKey := r.Header.Get("X-Guardian-Key")
		if apiKey == "" {
			apiKey = r.Header.Get("X-API-Key")
		}
		if apiKey == "" && len(r.Header.Get("Authorization")) > 7 {
			apiKey = r.Header.Get("Authorization")[7:]
		}
		if apiKey == "" && r.URL.Query().Get("apiKey") != "" {
			apiKey = r.URL.Query().Get("apiKey")
		}

		if apiKey != "" {
			tID, valid := validateApiKey(r.Context(), apiKey)
			if valid && tID != "" {
				resolvedTenantID = tID
				isAuthenticated = true
			}
		}
	}

	if !isAuthenticated {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Unauthorized: Missing or invalid API key"}`))
		return
	}

	var req InterceptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if resolvedTenantID != "" {
		// Anti-spoofing check
		if req.TenantID != "" && req.TenantID != resolvedTenantID && resolvedTenantID != "tenant_default" {
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(fmt.Sprintf(`{"error":"Forbidden: Client-supplied tenant_id '%s' does not match authenticated identity '%s'","code":"TENANT_SPOOFING_BLOCKED"}`, req.TenantID, resolvedTenantID)))
			return
		}
		req.TenantID = resolvedTenantID
	} else if req.TenantID == "" {
		req.TenantID = "tenant_default"
	}

	// 1. Server-Side Cost Bound Verification & Fraud Detection
	payloadText := fmt.Sprintf("%s %s %s", req.Action, req.Endpoint, req.PromptText)
	if req.Parameters != nil {
		pBytes, _ := json.Marshal(req.Parameters)
		payloadText += " " + string(pBytes)
	}
	charCount := float64(len(strings.TrimSpace(payloadText)))
	estimatedTokens := charCount / 4.0
	if estimatedTokens < 10 {
		estimatedTokens = 10
	}
	serverVerifiedCost := estimatedTokens * 0.00005 // $0.05 per 1,000 tokens

	costBypassAttempt := false
	effectiveCost := req.CostEstUSD

	if req.CostEstUSD == 0 && charCount > 15 {
		costBypassAttempt = true
		effectiveCost = serverVerifiedCost
		log.Printf("[Budget Fraud Alert] Agent %s reported $0.00 cost on payload (%f chars). Reconciled server-verified cost to $%.4f", req.AgentID, charCount, effectiveCost)
	} else if req.CostEstUSD < serverVerifiedCost*0.1 && charCount > 20 {
		costBypassAttempt = true
		effectiveCost = serverVerifiedCost
	}

	// Determine structured action type
	actionType := "standard"
	lowerAction := strings.ToLower(req.Action)
	lowerPayload := strings.ToLower(payloadText)

	if strings.Contains(lowerAction, "exec") || strings.Contains(lowerAction, "bash") || strings.Contains(lowerAction, "sudo") || strings.HasPrefix(lowerAction, "sh ") || strings.Contains(lowerPayload, "sudo ") || strings.Contains(lowerPayload, "cmd.exe") {
		actionType = "shell.exec"
	} else if strings.Contains(lowerAction, "drop table") || strings.Contains(lowerAction, "delete from") || strings.Contains(lowerAction, "truncate table") || strings.Contains(lowerPayload, "drop table") {
		actionType = "db.write"
	} else if strings.Contains(lowerAction, "rm -rf") || strings.Contains(lowerAction, "bulk_delete") || strings.Contains(lowerPayload, "rm -rf") {
		actionType = "file.delete"
	}

	// 2. Local Threat & Injection Detection
	isPromptInjection, containsSecrets := localSecurityScan(payloadText)

	// 3. Integrated Tier 2 Semantic Scan (Gemini / Cognitive Verification)
	var scanRes *SemanticScanResult
	if isPromptInjection || containsSecrets || actionType != "standard" || charCount > 15 {
		sRes, err := queryTier2SemanticScan(r.Context(), req)
		if err == nil && sRes != nil {
			scanRes = sRes
			if sRes.IsPromptInjection {
				isPromptInjection = true
			}
			if sRes.ContainsSecrets {
				containsSecrets = true
			}
			if sRes.ActionType != "" && sRes.ActionType != "standard" {
				actionType = sRes.ActionType
			}
		}
	}

	// 4. Tier 1 Policy Evaluation via OPA Engine (<10ms SLA)
	ctx := r.Context()
	results, err := opaQuery.Eval(ctx, rego.EvalInput(map[string]interface{}{
		"action":              req.Action,
		"action_type":         actionType,
		"agent_id":            req.AgentID,
		"tenant_id":           req.TenantID,
		"cost_est_usd":        req.CostEstUSD,
		"verified_cost":       effectiveCost,
		"cost_bypass_attempt": costBypassAttempt,
	}))

	authorized := false
	if err == nil && len(results) > 0 {
		if allowed, ok := results[0].Expressions[0].Value.(bool); ok {
			authorized = allowed
		}
	}

	// If semantic scan or local threat check flagged block, override authorized
	if isPromptInjection || containsSecrets || (scanRes != nil && scanRes.Recommendation == "BLOCK") {
		authorized = false
	}

	latencyMs := time.Since(startTime).Milliseconds()
	if latencyMs == 0 {
		latencyMs = 1
	}

	reqID := fmt.Sprintf("KG-%d", time.Now().UnixNano()/1e6)
	ledgerHashBytes := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%s:%d", req.TenantID, req.AgentID, req.Action, time.Now().UnixNano())))
	ledgerHash := "0x" + hex.EncodeToString(ledgerHashBytes[:])

	if !authorized {
		policyCode := "POL-SEC-01"
		reason := "Action matches forbidden non-human identity boundary constraint."

		if costBypassAttempt {
			policyCode = "POL-FIN-02"
			reason = fmt.Sprintf("Reported $0 cost on high-complexity request flagged as budget bypass attempt. Reconciled cost: $%.4f", effectiveCost)
		} else if actionType == "shell.exec" {
			policyCode = "POL-SEC-02"
			reason = "Raw shell command execution / system process spawn blocked by POL-SEC-02."
		} else if isPromptInjection {
			policyCode = "POL-SEC-01"
			reason = "Prompt injection / instruction override pattern detected by AgentsGuardian Canonical Governance Engine."
		} else if containsSecrets {
			policyCode = "POL-SEC-01"
			reason = "Unmasked API credential / secret / PII exposure detected in request payload."
		} else if scanRes != nil && scanRes.Reason != "" {
			reason = scanRes.Reason
		}

		resp := InterceptResponse{
			ID:             reqID,
			TenantID:       req.TenantID,
			Status:         "HALTED",
			Authorized:     false,
			PolicyViolated: policyCode,
			LatencyMs:      latencyMs,
			VerifiedCost:   effectiveCost,
			LedgerHash:     ledgerHash,
			Reason:         reason,
		}

		dispatchPubSubEvent(req, "HALTED", policyCode)

		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 5. Atomic Budget Check via Redis Lua Script / In-Memory Fallback
	budgetCap := 50.0
	budgetKey := fmt.Sprintf("tenant:%s:agent:%s:budget", req.TenantID, req.AgentID)

	budgetPassed := false
	if redisClient != nil {
		res, err := budgetLuaScript.Run(ctx, redisClient, []string{budgetKey}, effectiveCost, budgetCap).Result()
		if err == nil {
			if resSlice, ok := res.([]interface{}); ok && len(resSlice) == 2 {
				if flag, ok := resSlice[0].(int64); ok && flag == 1 {
					budgetPassed = true
				}
			}
		}
	}

	if !budgetPassed && redisClient == nil {
		memBudgetsMutex.Lock()
		current := memBudgets[budgetKey]
		if current+effectiveCost <= budgetCap {
			memBudgets[budgetKey] = current + effectiveCost
			budgetPassed = true
		}
		memBudgetsMutex.Unlock()
	}

	if !budgetPassed {
		resp := InterceptResponse{
			ID:             reqID,
			TenantID:       req.TenantID,
			Status:         "HALTED",
			Authorized:     false,
			PolicyViolated: "POL-FIN-01",
			LatencyMs:      latencyMs,
			VerifiedCost:   effectiveCost,
			LedgerHash:     ledgerHash,
			Reason:         fmt.Sprintf("Agent session budget cap of $50.00 exceeded (verified cost: $%.4f).", effectiveCost),
		}
		dispatchPubSubEvent(req, "HALTED", "POL-FIN-01")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 6. Return Authorized Verdict
	resp := InterceptResponse{
		ID:           reqID,
		TenantID:     req.TenantID,
		Status:       "AUTHORIZED",
		Authorized:   true,
		LatencyMs:    latencyMs,
		VerifiedCost: effectiveCost,
		LedgerHash:   ledgerHash,
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
