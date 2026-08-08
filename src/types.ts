/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PolicyCategory = 'security' | 'ethics' | 'finance';

export interface GoverningAgent {
  id: string;
  tenantId?: string;
  name: string;
  framework: 'LangChain' | 'CrewAI' | 'AutoGen' | 'MCP Server' | 'MCP Client' | 'Custom API' | 'ITSM Bot';
  webhookUrl: string;
  attachedPolicyCode: string;
  status: 'NOMINAL' | 'MITIGATING' | 'ALERT';
  requestCount: number;
}

export interface ApiRequestLog {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  endpoint: string;
  status: 'AUTHORIZED' | 'HALTED';
  latencyMs: number;
}

export interface Toast {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
}


export interface Policy {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  description: string;
  category: PolicyCategory;
  blastRadius: string; // e.g. "Non-Human Identity", "Database Actions"
  threshold: string;   // e.g. "Strict", "15% Shift", "$50.00 Limit"
  enabled: boolean;
  failureMode?: 'FAIL_CLOSED' | 'FAIL_OPEN_ALERT';
  sourceLaw?: string;
}

export interface TenantFailureModeConfig {
  securityFailMode: 'FAIL_CLOSED';
  ethicsFailMode: 'FAIL_CLOSED' | 'FAIL_OPEN_ALERT';
  financeFailMode: 'FAIL_OPEN_ALERT' | 'FAIL_CLOSED';
  notifyOnFailOpen: boolean;
  webhookAlertUrl?: string;
}

export interface KillSignalEvent {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentName: string;
  actionCommand: string;
  interceptedPacket: string; // API endpoint
  policyViolated: string;
  latencyMs: number; // e.g. 24 -> must be <35ms (GUARANTEED_SLA_MS)
  status: 'HALTED' | 'ALLOWED';
  rawJsonIntent: string;
  timestampAnnexV: string;
}

export interface DriftLogEvent {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentGroup: string;
  ethicalStandard: string;
  sentimentShiftPct: number;
  cognitiveHealthScore: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  remedatedAt?: string;
  logsDetails: string;
}

export interface ValueMeterMetric {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentName: string;
  completedTasks: number;
  totalApiSpend: number;
  humanLaborSaved: number;
  roiScore: number; // (humanLaborSaved / totalApiSpend)
  status: 'STABLE' | 'WARNING' | 'ALERT';
  latestViolatingCost?: number;
}

export interface LaborConfig {
  l1Rate: number; // Level 1 Triage / Standard Support ($/hr)
  l2Rate: number; // Level 2 DevOps / Systems Engineer ($/hr)
  l3Rate: number; // Level 3 SRE / Enterprise Architect ($/hr)
  auditRate: number; // Human-in-the-loop Audit Rate ($/hr)
  avgHoursPerTask: number; // Average human handling time per task (hours)
}


export interface AuditLedgerEntry {
  id: string;
  messageId?: string;
  tenantId: string;
  agentId: string;
  eventType: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
  signature: string;
  signatureStatus?: 'VALID_KMS' | 'PENDING_KMS_UNAVAILABLE';
  timestamp: string;
}

export type AdminRole = 'SuperAdmin' | 'Admin' | 'PolicyManager' | 'Auditor' | 'Operator';

export interface AdminUser {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'ACTIVE' | 'SUSPENDED';
  mfaEnabled: boolean;
  lastLogin: string;
  passwordHash?: string;
  passwordSalt?: string;
  resetToken?: string;
  resetTokenExpires?: string;
}

export interface RolePermission {
  role: AdminRole;
  configureKillSwitch: boolean;
  modifyPolicies: boolean;
  viewFinancialMetrics: boolean;
  updateGatewaySLAs: boolean;
  manageUsers: boolean;
}

export interface GlobalAdminSettings {
  bypassPolicyGuard: boolean;
  auditLogLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  maxSessionTimeoutHrs: number;
  ipWhitelistRange: string;
  mfaEnforcement: boolean;
  disableAlertsGlobally: boolean;
}

