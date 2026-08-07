-- AgentsGuardian Enterprise Cloud SQL / PostgreSQL Schema Definition & Migration
-- Revision: v1.2.0-Production-GaaS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE',
    gcp_marketplace_account_id VARCHAR(128),
    billing_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    framework VARCHAR(128) NOT NULL,
    webhook_url VARCHAR(512),
    attached_policy_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Governance Policies Table
CREATE TABLE IF NOT EXISTS policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('security', 'ethics', 'finance')),
    rule_bundle_ref VARCHAR(255),
    blast_radius VARCHAR(128),
    threshold_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Policy Versions Table (Append-only Audit History)
CREATE TABLE IF NOT EXISTS policy_versions (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    policy_snapshot JSONB NOT NULL,
    changed_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Ledger Table (Cryptographically Hash-Chained Append-Only)
CREATE TABLE IF NOT EXISTS audit_ledger (
    id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(128) UNIQUE,
    tenant_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    entry_hash VARCHAR(64) NOT NULL,
    signature VARCHAR(512) NOT NULL,
    signature_status VARCHAR(64) NOT NULL DEFAULT 'VALID_KMS',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dedicated Minimally-Privileged Application Runtime Role Definition
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'agentsguardian_app_runtime') THEN
    CREATE ROLE agentsguardian_app_runtime WITH LOGIN PASSWORD 'runtime_secure_password_gaas';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE agentsguardian_production TO agentsguardian_app_runtime;
GRANT USAGE ON SCHEMA public TO agentsguardian_app_runtime;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO agentsguardian_app_runtime;

-- Immutable Append-Only DB Role Restriction Enforcement
REVOKE UPDATE, DELETE ON audit_ledger FROM agentsguardian_app_runtime;
REVOKE UPDATE, DELETE ON audit_ledger FROM PUBLIC;

-- 6. Kill Events Table
CREATE TABLE IF NOT EXISTS kill_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    policy_code VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    action_taken VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Drift Events Table
CREATE TABLE IF NOT EXISTS drift_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    shift_percentage NUMERIC(5,2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    remediated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Budget Counters Table
CREATE TABLE IF NOT EXISTS budget_counters (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    spend_usd NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
    cap_usd NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    window_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. IAM Users, Roles & Role Assignments (Server-Enforced RBAC)
CREATE TABLE IF NOT EXISTS iam_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iam_roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE CHECK (name IN ('SuperAdmin', 'PolicyManager', 'Operator', 'Auditor')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS role_assignments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES iam_users(id) ON DELETE CASCADE,
    role_id VARCHAR(64) NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Default IAM Roles
INSERT INTO iam_roles (id, name, permissions) VALUES
('ROLE-SUPERADMIN', 'SuperAdmin', '["*"]'::jsonb),
('ROLE-POLICYMGR', 'PolicyManager', '["policies:create", "policies:update", "policies:delete", "policies:read"]'::jsonb),
('ROLE-OPERATOR', 'Operator', '["kill:trigger", "kill:clear", "drift:remediate", "agents:read"]'::jsonb),
('ROLE-AUDITOR', 'Auditor', '["audit:read", "audit:export", "compliance:verify"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
