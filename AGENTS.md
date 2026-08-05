# AGENTGUARDIAN OS — SYSTEM INSTRUCTIONS & GOVERNANCE RULES

## 1. Regulatory & Compliance Knowledge Base Rules
When citing, evaluating, or auditing regulatory frameworks, enforce the following accurate baseline references:

- California Regulations: 
  - DO NOT reference California SB-1047 (Vetoed in Sept 2024; never enacted).
  - Use California SB 53 (Enacted 2025) for frontier-model compliance presets.
- US Federal Posture:
  - DO NOT cite US Executive Order 14110 (Revoked in January 2025).
  - Refer to current US Federal Executive Policy frameworks governing AI risk.
- Colorado AI Act:
  - Frame enforcement status as "tracking / active transition" rather than settled law. Note that enforcement has been delayed to June 2026 with recent legislative amendments.
- EU AI Act (Regulation (EU) 2024/1689):
  - Article 12: Regulates automatic recording of logs (traceability/event logging).
  - Annex IV: Governs technical documentation requirements.
  - Maximum Fines/Penalties: Up to €35M or 7% of total worldwide annual turnover (DO NOT reference outdated €30M draft figures).

---

## 2. Latency & Performance Guardrail Definitions
Maintain technical integrity when describing latency metrics and real-time execution bounds:

- Distinction Between Kill-Switch Mechanisms:
  - Sub-10ms Execution: Reserved strictly for deterministic pre-action authorization (e.g., identity checks, rule-based ABAC, schema boundary filters, token/spending limit checks).
  - Sub-100ms / Sub-Second Interception: Applies to inference-based scanning, semantic threat analysis, prompt injection defense, and deep cognitive reasoning evaluation (accounting for model evaluation overhead).
- Contradiction Guard: Never combine "sub-10ms latency" with "deep semantic scanning" in a single metric, as model-based evaluation naturally requires tens to hundreds of milliseconds.

---

## 3. Financial & Labor Rate Benchmarking Standard
When calculating financial metrics, cost replacements, or CFO Value Meter outputs:

- Standard Hourly Rate References:
  - Require explicit baseline sources or contextual disclosures for default labor rates.
  - Avoid arbitrary rate assumptions without tagging them as configurable system defaults or citing industry benchmarks (e.g., BLS / Enterprise IT staffing norms 2025-2026).
- User Customization: Always prompt or allow the enterprise user to configure localized hourly labor billing rates for accurate ROI calculation.

---

## 4. UX & Role Architecture

### Landing View & Actionable Items Protocol
Design the primary post-login landing interface to prioritize immediate task execution and minimize cognitive load:
- Immediate Actionability: Upon user login, immediately surface high-priority actionable items, pending approvals, and critical alerts at the very top of the interface.
- Progressive Disclosure (Drill-Down UX):
  - DO NOT display full granular telemetry, deep logs, or secondary metadata on initial view by default.
  - Present concise summary cards (high-level metrics/alerts) with explicit "Drill Down" or "View Details" triggers for users who need deeper technical context.

### Role-Based View & Persona Scoping
Enforce strict Separation of Concerns across system user personas:
- Persona-Specific Dashboards: Tailor and scope UI components, widgets, and navigation views dynamically according to the authenticated user's role:
  - System Admin (SysAdmin): Focus on infrastructure health, node configurations, system properties, and uptime metrics.
  - Security Admin (CISO / Security Auditor): Focus on threat alerts, real-time kill-switch status, identity perimeters, and compliance audit ledgers.
  - Developer: Focus on API endpoints, script includes, integration hooks, and policy-as-code definitions.
- Visibility Isolation: Demarcate role-specific elements clearly, or hide irrelevant features entirely based on active role permissions to prevent workspace clutter.

### Customer Onboarding & Demo Hierarchy
Establish clear visual and structural distinction between onboarding setup and demonstration tools:
- Prominent Onboarding Placement: Make "Customer Onboarding" prominent, distinct, and immediately accessible upon initial setup.
- Separation from Static Demos: DO NOT group functional customer onboarding steps alongside static reference demos or simulation widgets. Onboarding must be framed as an active configuration path.

### Onboarding Workflow Execution & Global State Sync
Define deterministic completion behavior and state persistence following onboarding:
- Explicit Post-Completion Guidance: Upon completing Step 5 of the Onboarding Wizard, display a clear success confirmation banner and explicit navigation call-to-action (e.g., "Go to Overview Dashboard").
- System-Wide State Sync: Successfully completing Step 5 MUST automatically update system state across all platform modules (including Overview, Policy Engine, and Threat Monitors), transitioning the interface from "Setup Mode" to "Active Governance Mode".
