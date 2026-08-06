# Terraform Infrastructure Architecture for AgentsGuardian Sovereign GaaS
# Cloud Provider: Google Cloud Platform (GCP)
# Target Region: us-central1 / europe-west1

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.15.0"
    }
  }
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

# --- 4. Cloud SQL PostgreSQL Instance (Append-Only Audit Ledger) ---
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
  }
}

# --- 6. Cloud Run Services ---
resource "google_cloud_run_v2_service" "gateway_edge" {
  name     = "agentsguardian-gateway-edge"
  location = var.gcp_region

  template {
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
    containers {
      image = "gcr.io/${var.gcp_project_id}/ledger-writer:v1.2.0"
      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres_db.private_ip_address
      }
      env {
        name  = "KMS_KEY_REF"
        value = google_kms_crypto_key.audit_signer_key.id
      }
    }
  }
}

# --- 7. IAM Roles & Service Account Bindings ---
resource "google_service_account" "agentsguardian_sa" {
  account_id   = "agentsguardian-sa"
  display_name = "AgentsGuardian Production Microservices Service Account"
}

resource "google_project_iam_member" "sa_kms_signer" {
  project = var.gcp_project_id
  role    = "roles/cloudkms.signerVerifier"
  member  = "serviceAccount:${google_service_account.agentsguardian_sa.email}"
}

resource "google_project_iam_member" "sa_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.agentsguardian_sa.email}"
}

resource "google_project_iam_member" "sa_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.agentsguardian_sa.email}"
}
