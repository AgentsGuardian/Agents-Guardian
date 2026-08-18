# Solution Design Document: AgentsGuardian
**Enterprise AI Governance, Real-Time Guardrails, GCP Marketplace Integration, and Sovereign OS Platform**
*Version: 2.6 — Comprehensive Systems Specification, Identity Lifecycle, Marketplace Architecture & Regulatory Baseline*

---

## 1. Executive Summary & Audit Baseline

As enterprise adoption of autonomous agentic systems accelerates, organizations face critical operational, legal, and security risks: unaligned cognitive decisions, demographic and sentiment drift, runaway token expenditures, and compromised identity tokens.

**AgentsGuardian** is a zero-trust enterprise AI Governance-as-a-Service (GaaS) platform operating as an inline security gateway, cognitive auditor, financial throttle, and commercial provisioning engine. Intercepting autonomous agent telemetry in real-time, the platform evaluates every agent action against cryptographic policies, audits behavioral patterns, enforces budget boundaries, and maintains an immutable Annex IV-compliant audit trail.

### Key Platform Capabilities & Technical Milestones
* **Deterministic Action Interceptor**: Pre-action authorization kernel delivering sub-10ms rule matching and a single source of truth gateway SLA guarantee of **<35ms** (`GUARANTEED_SLA_MS = 35`).
* **Real Upstream Inline Proxy**: Zero-trust reverse proxy (`/v1/proxy/:tenant_id/*`) validating tenant API keys (`ag_live_*`), enforcing policy rules and budget caps, and upon clearance invoking the real Google Gemini API (`gemini-2.5-flash` via `@google/genai`) to return genuine AI completions.
* **Real Authenticated Admin Gateway & IAM**: Backend Express authentication endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/session`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`) handling federated user identity, role-based authorization, rate-limited brute force protection, 15-minute account lockout on repeated failures, and master SuperAdmin ownership (`mritunjoysingh@gmail.com`).
* **In-App Administrative Credential Re-Keying**: Direct password updating modal (`UpdatePasswordModal.tsx`) available both from the user's active session security profile dropdown and the Admin IAM console inspector.
* **GCP Marketplace Lifecycle Integration**: Native webhook endpoint (`/api/v1/marketplace/webhook`) handling Google Cloud Marketplace entitlement events (`ENTITLEMENT_CREATION_REQUESTED`, `ENTITLEMENT_PLAN_CHANGED`, `ENTITLEMENT_CANCELLED`, `ENTITLEMENT_ACTIVE`), automated multi-tenant provisioning, usage metering emission (`/api/v1/marketplace/metering`), 0.00% discrepancy reconciliation (`/api/v1/marketplace/reconcile`), and SLA reporting.
* **Multi-Tenant Isolation & 27-Point Hardening Suite**: Strict tenant boundary assertions (`/api/v1/marketplace/tenant-isolation-test`) verifying 0 cross-tenant data leakage across policy rules, audit ledgers, Redis cache namespaces, session budgets, and scope definitions. Automated regression verification passing all integration assertions.
* **Statutory Regulatory Compliance Baseline**: Fully updated compliance presets aligning with California SB 53 (2025 Enacted Statute), US Federal Executive AI Policy Framework, Colorado AI Act (SB 24-205, June 2026 enforcement transition), and EU AI Act (Regulation (EU) 2024/1689, Art. 12 & Annex IV with max penalty €35M or 7% global annual turnover).

---

## 2. Product Architecture & Technical Pillars

AgentsGuardian is structured into four core functional layers combining real-time gateway interception, cognitive audit, economic throttling, and cloud marketplace procurement:

```
                            [ AGENT Telemetry & API Calls ]
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
            [ Real Inline Proxy Gate ]             [ GCP Marketplace Webhook ]
            (/v1/proxy/:tenant_id/*)               (/api/v1/marketplace/*)
                        │                                   │
       ┌────────────────┼────────────────┐                  │
       ▼                ▼                ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────┐   ┌──────────────┐
│  SECURE     │  │  OBSERVE    │  │  MEASURE     │   │ MARKETPLACE  │
│  Pillar     │  │  Pillar     │  │  Pillar      │   │ PROVISIONING │
├─────────────┤  ├─────────────┤  ├──────────────┤   ├──────────────┤
│ Intercepts  │  │ Cognitive   │  │ Economic     │   │ Entitlements │
│ Kill-Switch │  │ Bias/Drift  │  │ ROI Tracker  │   │ Metering Ops │
│ Annex IV    │  │ Sentiment   │  │ Budget Caps  │   │ Reconcile    │
└─────────────┘  └─────────────┘  └──────────────┘   └──────────────┘
```

### Pillar 1: Deterministic Interception (Secure)
Synchronous pre-action authorization loop. Evaluates parsed JSON goals from agent workloads against active policy rules before sending requests to upstream AI models.
* **Reactive Interceptor Engine**: Multi-step pipeline executing ingestion, vigilance scanning, risk evaluation, and immediate automatic termination (Kill-Switch).
* **Annex IV Cryptographic Ledger**: Immutable audit ledger recording transaction timestamps, latency metrics, and verification hashes for compliance reviews.

### Pillar 2: Cognitive Drift & Bias Auditing (Observe)
Asynchronous reasoning layer evaluating model response patterns to detect policy or demographic drift.
* **Real Telemetry Stream & REST Endpoints**: Authentic drift/bias telemetry polled from backend endpoint (`/api/drift-events`, `/api/v1/drift-events`) sourced from the Tier 2 semantic scan engine without synthetic client-side fabrication.
* **Explicit Empty State & Tenant Scoping**: Clean and honest empty dashboard state ("No drift/bias events recorded yet") when zero drift events have been logged for a given tenant, preventing misleading synthetic mock representations.
* **Lighthouse Cognitive Evaluator**: Monitors language shifts representing sentiment or demographic bias (e.g., response variance across client categories).
* **Compliance Timeline**: Chronological record of evaluation checkpoints, drift benchmarks, and automated alignment procedures.

### Pillar 3: Economic Budget Guarding (Measure)
Automated cost tracking and token throttling console.
* **CFO Journey Timeline & Labor Benchmarks**: Interactive configurable labor rate benchmarks ($35/hr L1 Support, $75/hr L2 Security Engineer, $150/hr L3 AI Architect, $60/hr Compliance Auditor) computing Net Cost Avoidance and ROI Multipliers.
* **Economic Stress Tests**: 6 interactive simulation scenarios assessing high-ROI workflows versus runaway token loops (e.g., 1M token context bloat or recursive infinite agent loops).

### Pillar 4: GCP Marketplace & Multi-Tenant Commerce (Marketplace)
Commercial orchestration layer managing enterprise customer lifecycle.
* **Entitlement Lifecycle Processor**: Automated account creation, live API key generation (`ag_live_*`), default policy bundle initialization (Security, Ethics, Finance), and plan budget allocation ($500 for ENTERPRISE, $1000 for ENTERPRISE_CUSTOM).
* **Usage Metering & 0.00% Discrepancy Reconciliation**: Periodic usage emission anchored to ledger hashes, verified against raw request logs with zero discrepancy tolerance.
* **Multi-Tenant Isolation Assurance**: 5-tier isolation verification ensuring multi-tenant data privacy across policies, audit ledgers, memory stores, budget allocations, and execution scopes.

---

## 3. Component Architecture & System Specification

The application architecture combines a real Node.js/Express server (`server.ts`) with a React 18 SPA frontend powered by a centralized state store (`useGovernanceStore.ts`).

### Directory Structure & Component Map
```
src/
├── App.tsx                       # Main Layout, Tab Router, User Session & Theme Engine
├── types.ts                      # TypeScript Interfaces, Enums & Marketplace Schemas
├── data.ts                       # Baseline Seed Data & Policy Presets
├── utils.ts                      # Currency/Date Formatters & SLA Constants
├── statusEngine.ts               # Status Derivation Bridge
├── solutionDesignContent.ts      # Embedded Solution Design Specification String
├── store/
│   └── useGovernanceStore.ts     # Centralized State Store linked to Backend REST APIs
└── components/
    ├── Sidebar.tsx               # Collapsible Multi-Pillar Navigation & User Session Switcher
    ├── Overview.tsx              # Health Gauges, 30-Day Heatmap & Live Sentinel Stream
    ├── CustomerOnboarding.tsx    # 5-Step Integration Wizard, Onboarding Copilot & Test Handshake
    ├── SecurePillar.tsx          # Real-time Kill-Switch Simulator & Annex IV Audit Ledger
    ├── ObservePillar.tsx         # Bias Evaluator, Guideline Loader & Drift Remediation
    ├── MeasurePillar.tsx         # CFO Budget Console, Wage Benchmarks & Economic Stress Tests
    ├── PolicyConfig.tsx          # Regulatory Act Ingestion (PDF), Rule Index & Active Laws
    ├── GaaSApiPillar.tsx         # Agent Directory, Marketplace Status & Webhook Sandbox
    ├── AdminPillar.tsx           # Authenticated User Table, Role Matrix & Dry-Run Bypass Guard
    ├── GaaSAccessGate.tsx        # Login/Registration Gateway with Backend Auth Endpoints
    ├── UpdatePasswordModal.tsx   # Administrative Credential Re-Keying Interface
    ├── HelpCenter.tsx            # Comprehensive System Manual, Tour, FAQ & GenAI Copilot
    └── ToastNotifier.tsx         # Floating Toast System
```

---

## 4. Authentication, IAM & Credential Lifecycle Specification

AgentsGuardian enforces zero-trust identity verification across both system administrators and agent workloads:

### 4.1 Authentication Endpoints (`/api/auth/*`)
* `POST /api/auth/login`: Authenticates corporate credentials against bcrypt-hashed admin passwords. Generates a signed bearer session token (`session_<user_id>`). Enforces 15-minute account lockout after 5 consecutive failed attempts.
* `POST /api/auth/register`: Onboards new administrative identities under tenant scope.
* `GET /api/auth/session`: Validates active session token from `Authorization: Bearer <token>` or `x-admin-session` headers.
* `POST /api/auth/change-password`: Cryptographically verifies the existing password (or master SuperAdmin seed) and updates to a new 12+ character credential for the currently authenticated session, invalidating prior sessions.
* `POST /api/admin/users/:userId/reset-password`: Administrative credential reset endpoint gated by `requireAdminAuth` and `requireRole(['SuperAdmin', 'Admin'])`. Dispatches an out-of-band reset token to the target user's registered email without exposing tokens in the HTTP payload, sets `mustResetPassword: true` on the target account, and leaves the acting administrator's own credentials and session untouched while recording a high-severity `ADMIN_INITIATED_PASSWORD_RESET` entry in the immutable audit ledger.
* `POST /api/auth/forgot-password`: Generates a rate-limited secure password reset keycard, logging the security dispatch event on the backend.
* `POST /api/auth/reset-password`: Validates the one-time reset keycard and stores the new administrative password.
* `POST /api/auth/logout`: Revokes active bearer session tokens on the server.

### 4.2 Role-Based Access Control (RBAC) Persona Architecture
* **SuperAdmin (`mritunjoysingh@gmail.com`)**: Master authority with full permission to configure kill-switches, modify dry-run bypass guards, manage tenant subscriptions, and provision/re-key IAM credentials.
* **Security Admin (CISO / Security Auditor)**: Scoped access to real-time threat alerts, kill-switch triggers, perimeter rules, and cryptographic Annex IV audit ledgers.
* **SysAdmin (Infrastructure Operations)**: Scoped access to node telemetry, uptime metrics, container health, and proxy latency monitors.
* **Developer**: Scoped access to API proxy endpoints, integration SDK code generators, webhook testing sandboxes, and policy-as-code definitions.

### 4.3 UX Progressive Disclosure & Landing View Protocol
* **Immediate Actionability**: High-priority alerts, pending approvals, and kill-switch statuses are surfaced immediately upon login.
* **Progressive Disclosure**: High-level overview metrics provide quick executive summaries with explicit "Drill Down" triggers to prevent cognitive overload.
* **Onboarding & Global State Sync**: Completing Step 5 of the Customer Onboarding Wizard displays a confirmation banner and transitions all platform modules from "Setup Mode" to "Active Governance Mode".

---

## 5. GCP Marketplace Lifecycle & API Specifications

### 5.1 Entitlement Webhook Endpoint
`POST /api/v1/marketplace/webhook`
* **Supported Events**:
  * `ENTITLEMENT_CREATION_REQUESTED`: Provisions tenant account, generates `ag_live_*` API key, seeds baseline policy bundle, sets plan budget cap.
  * `ENTITLEMENT_PLAN_CHANGED`: Upgrades or downgrades tier, recalculating budget caps and rate limits.
  * `ENTITLEMENT_CANCELLED`: Deactivates tenant account, revokes API keys, marks status as `CANCELLED`.
  * `ENTITLEMENT_ACTIVE`: Confirms active billing status.

### 5.2 Metering & Reconciliation APIs
* `POST /api/v1/marketplace/metering`: Emits hourly usage counts anchored to cryptographic ledger hashes.
* `GET /POST /api/v1/marketplace/reconcile`: Cross-audits raw transaction logs against emitted marketplace usage records, returning a 0.00% discrepancy verification report.

### 5.3 Multi-Tenant Isolation Verification
`GET /POST /api/v1/marketplace/tenant-isolation-test`
* Evaluates 5 isolation vectors:
  1. **Policy Isolation**: Prevents Tenant A from reading Tenant B's custom rules.
  2. **Ledger Isolation**: Ensures audit logs are partitioned by tenant ID.
  3. **Cache Separation**: Guarantees Redis/Memory key namespace isolation (`tenant:{id}:*`).
  4. **Budget Independence**: Enforces isolated spending limits per tenant.
  5. **Scope Boundaries**: Restricts administrative role actions to assigned tenant scopes.

---

## 6. Regulatory & Compliance Baseline Matrix

AgentsGuardian enforces current statutory frameworks across all policy templates:

| Regulatory Framework | Enactment Status & Timeline | Platform Implementation & Enforcement Mechanism |
| :--- | :--- | :--- |
| **California SB 53** | **Enacted 2025 Statute** *(Supersedes vetoed SB-1047)* | Frontier-model compliance preset; mandates developer emergency shutdown / kill-switch capability and incident reporting logs. |
| **US Federal Policy** | **Current Executive Policy** *(Post-EO 14110)* | Federal AI risk management posture; enforces red-teaming standards, prompt injection defense, and non-human identity boundaries. |
| **Colorado AI Act** *(SB 24-205)* | **Tracking / Active Transition** *(Enforcement delayed to June 2026)* | Risk mitigation requirements under amended SB 24-205; periodic security log validation and algorithm bias monitoring. |
| **EU AI Act** *(Reg. EU 2024/1689)* | **Enacted & Active** *(Max penalty: €35M or 7% global turnover)* | **Article 12**: Automatic log recording (traceability/event logging); **Annex IV**: Immutable technical documentation ledger keys. |

---

## 7. System Technical Standards & Performance Bounds

To eliminate data drift, latency ambiguity, and formatting errors, AgentsGuardian enforces strict global standards:

### 7.1 SLA & Latency Performance Bounds
* **Single Source SLA**: All gateway components reference `GUARANTEED_SLA_MS = 35` (Target: `<35ms`).
* **Execution Boundary Segregation**:
  * **Sub-10ms Execution**: Reserved strictly for deterministic pre-action authorization (identity checks, ABAC rules, schema filters, spending limit checks).
  * **Sub-35ms SLA Guarantee**: Guaranteed interception and policy evaluation boundary across proxy endpoints.
  * **Sub-100ms / Sub-second Execution**: Applied to inference-based scanning, semantic threat analysis, prompt injection defense, deep cognitive reasoning, and Gemini LLM upstream completions.

### 7.2 Financial & Labor Rate Benchmarking Standard
* **Configurable Hourly Labor Rates**: Defaults pegged to US Bureau of Labor Statistics (BLS) and enterprise IT staffing norms ($35/hr Tier 1 Support, $75/hr Tier 2 SOC Analyst, $150/hr Tier 3 AI Governance Architect, $60/hr Compliance Auditor).
* **Currency Formatting**: Standardized via `formatCurrency(amount)` to ensure exact 2 decimal places and comma separators (e.g., `$8,707.50`).
* **Timestamp Formatting**: Standardized via `formatTimestamp(isoString)` as `MMM DD, YYYY · HH:mm:ss`.
* **Transaction ID Factory**: Uniform format via `generateTransactionId(prefix)` producing `<PREFIX>-<TIMESTAMP>-<RANDOM>`.

---

## 8. Client-Side Integration & Deployment Guide

Connecting client codebases to AgentsGuardian GaaS requires 3 simple methods:

### Method 1: Zero-Code Proxy Redirect (Recommended)
Set the OpenAI or Anthropic base URL environment variable to point to the AgentsGuardian proxy:

```bash
export OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"
export OPENAI_API_KEY="ag_live_7a3d2e9c8f104b"
```

In Python:
```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL")
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Execute database migration on production records."}],
    extra_headers={
        "X-Guardian-Tenant-ID": "tenant_ent_9824",
        "X-Guardian-SLA-Mode": "strict"
    }
)
print(response.choices[0].message.content)
```

Upon authorization, AgentsGuardian invokes the real Gemini API model (`gemini-2.5-flash`) and returns genuine AI completions directly to the client.

---

## 9. Automated Hardening & Verification Suite

AgentsGuardian includes automated end-to-end regression test suites (`scripts/test-phase5-hardening.ts` and `scripts/test-phase-f-hardening.ts`) validating critical system assertions:

```bash
npx tsx scripts/test-phase5-hardening.ts
npx tsx scripts/test-phase-f-hardening.ts
```

### Verified Test Vectors
1. **Express Server Boot**: Health check endpoint returns `200 OK`.
2. **Marketplace Webhook Ingestion**: Processes `ENTITLEMENT_CREATION_REQUESTED` and provisions active tenant.
3. **API Key Issuance**: Generates `ag_live_*` tenant keycard.
4. **Default Policy Bundles**: Seeds Security, Ethics, and Finance guardrails.
5. **Plan Budget Calibration**: Sets $500 cap for Enterprise tier.
6. **Plan Upgrade**: Processes `ENTITLEMENT_PLAN_CHANGED` and scales budget cap to $1000.
7. **Inline Proxy Authorization**: Intercepts valid prompts, checks tenant keys, invokes Gemini model, and returns response.
8. **Threat Policy Blocking**: Intercepts malicious prompt injections and blocks execution with `403 Forbidden`.
9. **Budget Cap Enforcement**: Halts transactions when cumulative spend exceeds budget ceiling.
10. **Usage Metering Emission**: Reports transaction counts with cryptographic ledger hashes.
11. **Metering Reconciliation**: Cross-audits logs returning 0.00% discrepancy verification.
12. **Multi-Tenant Isolation**: Confirms 0 cross-tenant data leakage across 5 isolation levels.
13. **Subscription Cancellation**: Processes `ENTITLEMENT_CANCELLED`, revoking API access.
14. **Authentication & Session Lifecycle**: Verifies `/api/auth/login`, `/api/auth/register`, `/api/auth/session`, and `/api/auth/change-password` with rate-limiting and brute-force lockout.

---

*This Solution Design Specification represents the authoritative technical contract for the AgentsGuardian AI Governance OS platform.*

