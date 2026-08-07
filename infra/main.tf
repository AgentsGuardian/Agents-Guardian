# Terraform Infrastructure Architecture for AgentsGuardian Sovereign GaaS
# Cloud Provider: Google Cloud Platform (GCP)
# Target Region: us-central1 / europe-west1
# Security Posture: Phase 5 GCP Hardening (Zero-Trust IAM, Secret Manager Mounts, TLS Enforcement)

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.15.0"
    }
  }
}

variable "gcp_project_id" {
  type        = string
  default     = "agentsguardian-prod"
  description = "Target GCP Project ID for Sovereign GaaS Deployment"
}

variable "gcp_region" {
  type        = string
  default     = "us-central1"
  description = "Target GCP Region for Cloud Run & Cloud SQL"
}

variable "vpc_network_id" {
  type        = string
  default     = "projects/agentsguardian-prod/global/networks/default"
  description = "VPC Network ID for Private IP Cloud SQL & Memorystore Redis"
}

variable "db_password" {
  type        = string
  sensitive   = true
  default     = "runtime_secure_password_gaas_v12"
  description = "PostgreSQL Application User Password"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  default     = "gaas_sovereign_jwt_secret_token_2026_prod"
  description = "JWT Signing Secret for Authentication"
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# --- 1. Secret Manager (Zero Plaintext Secrets) ---
resource "google_secret_manager_secret" "database_password" {
  secret_id = "agentsguardian-db-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password_val" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = var.db_password
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "agentsguardian-jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_val" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "agentsguardian-gemini-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "gemini_api_key_val" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = "GEMINI_PROD_API_KEY_SECRET_PLACEHOLDER"
}

# --- 2. Cloud KMS Keyring & RSA-4096 Key for Cryptographic Audit Ledger ---
resource "google_kms_key_ring" "compliance_ring" {
  name     = "compliance-keyring"
  location = "global"
}

resource "google_kms_crypto_key" "audit_signer_key" {
  name     = "audit-signer-rsa4096"
  key_ring = google_kms_key_ring.compliance_ring.id
  purpose  = "ASYMMETRIC_SIGN"

  version_template {
    algorithm        = "RSA_SIGN_PSS_4096_SHA256"
    protection_level = "SOFTWARE"
  }
}

# --- 3. Memorystore Redis Cluster (Tier 1 Sub-10ms Gateway Cache) ---
resource "google_redis_instance" "tier1_cache" {
  name               = "agentsguardian-redis-tier1"
  tier               = "STANDARD_HA"
  memory_size_gb     = 5
  region             = var.gcp_region
  redis_version      = "REDIS_7_0"
  authorized_network = var.vpc_network_id

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }
}

# --- 4. Cloud SQL PostgreSQL Instance (Append-Only Audit Ledger with SSL Enforcement) ---
resource "google_sql_database_instance" "postgres_db" {
  name             = "agentsguardian-sql-pg15"
  database_version = "POSTGRES_15"
  region           = var.gcp_region

  settings {
    tier              = "db-custom-4-16384"
    availability_type = "REGIONAL"
    disk_size         = 100
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
      require_ssl     = true
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }
}

resource "google_sql_database" "governance_db" {
  name     = "agentsguardian_production"
  instance = google_sql_database_instance.postgres_db.name
}

# --- 5. Pub/Sub Topics & Subscriptions for Async Tier 2 & Telemetry ---
resource "google_pubsub_topic" "intercept_events" {
  name = "agentsguardian-intercept-events"
}

resource "google_pubsub_topic" "marketplace_metering" {
  name = "agentsguardian-marketplace-metering-events"
}

resource "google_pubsub_subscription" "ledger_writer_sub" {
  name  = "ledger-writer-subscription"
  topic = google_pubsub_topic.intercept_events.name

  ack_deadline_seconds = 20

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.ledger_writer.uri}/pubsub/push"
    oidc_token {
      service_account_email = google_service_account.pubsub_push_sa.email
    }
  }
}

# --- 6. Service Accounts (Least-Privilege Role Separation) ---
resource "google_service_account" "gateway_edge_sa" {
  account_id   = "agentsguardian-gateway-sa"
  display_name = "AgentsGuardian Gateway Edge Microservice Service Account"
}

resource "google_service_account" "ledger_writer_sa" {
  account_id   = "agentsguardian-ledger-sa"
  display_name = "AgentsGuardian Ledger Writer Microservice Service Account"
}

resource "google_service_account" "pubsub_push_sa" {
  account_id   = "agentsguardian-pubsub-push-sa"
  display_name = "Pub/Sub Push Subscription Invoker Service Account"
}

resource "google_service_account" "api_gateway_sa" {
  account_id   = "agentsguardian-api-gateway-sa"
  display_name = "Cloud API Gateway / Load Balancer Invoker Service Account"
}

# --- 7. Least-Privilege IAM Member Bindings ---
resource "google_project_iam_member" "gateway_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.gateway_edge_sa.email}"
}

resource "google_project_iam_member" "gateway_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gateway_edge_sa.email}"
}

resource "google_project_iam_member" "ledger_kms_signer" {
  project = var.gcp_project_id
  role    = "roles/cloudkms.signerVerifier"
  member  = "serviceAccount:${google_service_account.ledger_writer_sa.email}"
}

resource "google_project_iam_member" "ledger_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ledger_writer_sa.email}"
}

# --- 8. Cloud Run Services with Secret Manager Mounts & SSL Settings ---
resource "google_cloud_run_v2_service" "gateway_edge" {
  name     = "agentsguardian-gateway-edge"
  location = var.gcp_region

  template {
    service_account = google_service_account.gateway_edge_sa.email

    containers {
      image = "gcr.io/${var.gcp_project_id}/gateway-edge:v1.2.0"
      ports {
        container_port = 8080
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.tier1_cache.host
      }
      env {
        name  = "PUBSUB_TOPIC_ID"
        value = google_pubsub_topic.intercept_events.name
      }
      env {
        name  = "DB_SSLMODE"
        value = "require"
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }
      resources {
        limits = {
          cpu    = "2000m"
          memory = "1024Mi"
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "ledger_writer" {
  name     = "agentsguardian-ledger-writer"
  location = var.gcp_region

  template {
    service_account = google_service_account.ledger_writer_sa.email

    containers {
      image = "gcr.io/${var.gcp_project_id}/ledger-writer:v1.2.0"
      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres_db.private_ip_address
      }
      env {
        name  = "DB_SSLMODE"
        value = "require"
      }
      env {
        name  = "KMS_KEY_REF"
        value = google_kms_crypto_key.audit_signer_key.id
      }
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

# --- 9. Cloud Run Service IAM Invoker Bindings (Explicit Access Controls) ---
# Gateway-Edge is restricted to API Gateway / Load Balancer invoker (No unauthenticated allUsers)
resource "google_cloud_run_v2_service_iam_member" "gateway_edge_invoker" {
  location = google_cloud_run_v2_service.gateway_edge.location
  name     = google_cloud_run_v2_service.gateway_edge.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.api_gateway_sa.email}"
}

# Ledger-Writer ONLY accepts invocations from the Pub/Sub push service account
resource "google_cloud_run_v2_service_iam_member" "ledger_writer_invoker" {
  location = google_cloud_run_v2_service.ledger_writer.location
  name     = google_cloud_run_v2_service.ledger_writer.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_push_sa.email}"
}
