# Gateway Edge Service (Cloud Run / Go)

The **Gateway Edge Service** provides ultra-low latency (<10ms target SLA) pre-action authorization (Tier 1 ABAC & Budget checking) for non-human AI agents.

## Architecture & Responsibilities
1. **Sub-10ms ABAC Enforcement**: Evaluates incoming agent actions against embedded Open Policy Agent (OPA) Rego rules.
2. **Redis Atomic Budget Locking**: Tracks real-time token spend per agent session (`tenant:{id}:agent:{id}:budget`).
3. **Async Telemetry Hand-off**: Publishes interception events asynchronously to Cloud Pub/Sub for Tier 2 deep scanning and Cloud SQL hash-chained ledger writing.

## Required GCP IAM Roles
- `roles/pubsub.publisher`: To emit async audit and metering events.
- `roles/redis.editor`: Access to Memorystore Redis cluster.
- `roles/secretmanager.secretAccessor`: Secure secret retrieval.

## Deployment Command
```bash
gcloud run deploy agentsguardian-gateway-edge \
  --image gcr.io/agentsguardian-prod/gateway-edge:v1.2.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars REDIS_HOST=10.0.0.3:6379,GCP_PROJECT_ID=agentsguardian-prod
```
