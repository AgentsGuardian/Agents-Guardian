# Ledger Writer Service (Cloud Run / Go)

The **Ledger Writer Service** consumes interception telemetry from Pub/Sub push endpoints and guarantees tamper-evident storage using a **Cryptographically Hash-Chained Append-Only Audit Ledger** signed via Cloud KMS RSA-4096.

## Hash Chain Invariants
1. `payload_hash = SHA256(JSON(event))`
2. `entry_hash = SHA256(payload_hash + ":" + prev_hash)`
3. `signature = Cloud KMS RSA-4096 AsymmetricSign(entry_hash)`
4. `UPDATE` and `DELETE` SQL operations are revoked at the PostgreSQL database role level (`REVOKE UPDATE, DELETE ON audit_ledger FROM PUBLIC;`).

## Required GCP IAM Roles
- `roles/cloudkms.signerVerifier`: Access to sign entry digests with Cloud KMS RSA-4096.
- `roles/cloudsql.client`: Private IP Cloud SQL proxy access.
- `roles/secretmanager.secretAccessor`: Retrieving database credentials.

## Deployment Command
```bash
gcloud run deploy agentsguardian-ledger-writer \
  --image gcr.io/agentsguardian-prod/ledger-writer:v1.2.0 \
  --platform managed \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars DB_HOST=10.0.0.4,KMS_KEY_REF=projects/agentsguardian/locations/global/keyRings/compliance-ring/cryptoKeys/audit-signer-rsa4096
```
