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
  status: 'NOMINAL' | 'MITIGATING' | 'ALERT' | 'HALTED';
  requestCount: number;
  apiKey?: string;
  haltedByEventId?: string;
  haltedByReason?: string;
}

export type InterceptDecision =
  | 'ALLOW'
  | 'ALLOWED'
  | 'DENY'
  | 'HALT'
  | 'THROTTLE'
  | 'WARN'
  | 'HALTED_AGENT_DENIED'
  | 'REJECTED';

export interface OverviewStats {
  total: number;
  allowed: number;
  blocked: number;
}

export interface ApiRequestLog {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  endpoint: string;
  status: 'AUTHORIZED' | 'HALTED';
  decision?: InterceptDecision;
  reason?: string;
  policy_code?: string | null;
  confidence?: number | null;
  haltedByEventId?: string;
  haltedByReason?: string;
  latencyMs: number;
  kms_signature?: string;
  kms_key_version?: string;
}

export interface Toast {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
}


export type PolicyEnforcementOutcome = 'KILL_SWITCH' | 'DENY' | 'THROTTLE' | 'WARN';

export interface ExecutableRuleDefinition {
  enforcementMode?: PolicyEnforcementOutcome;
  actionsDenied?: string[];
  actionsAllowed?: string[];
  actionPatterns?: string[];
  endpointsDenied?: string[];
  endpointsAllowed?: string[];
  agentsDenied?: string[];
  agentsAllowed?: string[];
  forbiddenKeywords?: string[];
  regexPatterns?: string[];
  requiredParameters?: string[];
  forbiddenParameters?: string[];
  maxCostUsd?: number;
  maxTokens?: number;
  driftThresholdPct?: number;
  disallowedSentimentKeywords?: string[];
  isWebActionProtection?: boolean;
  checkSecrets?: boolean;
  checkPromptInjection?: boolean;
  compiledAt?: string;
  sourceLaw?: string;
  customCondition?: string;
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
  rules?: ExecutableRuleDefinition;
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
  agentId?: string;
  agent_id?: string;
  timestamp: string;
  agentName: string;
  actionCommand: string;
  interceptedPacket: string; // API endpoint
  policyViolated: string;
  policy_code?: string | null;
  decision?: InterceptDecision;
  reason?: string;
  confidence?: number | null;
  haltedByEventId?: string;
  haltedByReason?: string;
  latencyMs: number; // e.g. 24 -> must be <35ms (GUARANTEED_SLA_MS)
  status: 'HALTED' | 'ALLOWED';
  rawJsonIntent: string;
  promptText?: string;
  prompt_text?: string;
  timestampAnnexV: string;
  kms_signature?: string;
  kms_key_version?: string;
}

export interface DriftLogEvent {
  id: string;
  tenantId?: string;
  timestamp: string;
  agentGroup: string;
  agentId?: string;
  agentType?: 'llm_chat' | 'tool_agent' | 'rpa_bot' | 'mcp_server' | 'framework_agent' | 'other';
  ethicalStandard: string;
  sentimentShiftPct: number;
  cognitiveHealthScore: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'HEALTHY';
  remedatedAt?: string;
  remediationNotes?: string;
  remediationTicketId?: string;
  logsDetails: string;
  metricsMoved?: string[];
  baselineValues?: Record<string, any>;
  currentValues?: Record<string, any>;
  judgeReasons?: string[];
  sampleSize?: number;
  evidenceEventIds?: string[];
  isTest?: boolean;
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  policyBreached?: string;
  complianceScore?: number;
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
  kms_signature?: string;
  kms_key_version?: string;
}

export type AdminRole = 'SuperAdmin' | 'Admin' | 'PolicyManager' | 'Auditor' | 'Operator';

export interface AdminUser {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'REJECTED';
  mfaEnabled: boolean;
  lastLogin: string;
  passwordHash?: string;
  passwordSalt?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  mustResetPassword?: boolean;
  organization?: string;
  registrationNotes?: string;
  registeredAt?: string;
  oneTimePassword?: string;
  oneTimePasswordIssuedAt?: string;
  registeredPasswordHash?: string;
  registeredPasswordSalt?: string;
  registeredPasswordPlain?: string;
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

export type AgentType = 'llm_chat' | 'tool_agent' | 'rpa_bot' | 'mcp_server' | 'framework_agent' | 'other';

export interface MetricComparison {
  baseline: number | null;
  current: number | null;
  unit?: string;
  measured: boolean;
  deltaText?: string;
}

export interface AgentHealthProfile {
  agentId: string;
  agentName: string;
  agentType: AgentType;
  tenantId: string;
  eventCount: number;
  baselineComplete: boolean;
  baselineRequired: number;
  healthIndex: number | null; // null if baselining/no data
  healthLabel: 'Cognitive Health' | 'Behavioral Health';
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'BASELINING' | 'NO DATA';
  statusDisplay: string;
  lastUpdated: string;
  killSwitchStatus: 'NOMINAL' | 'HALTED';
  attachedPolicyCode: string;
  scoreChangeVsBaseline: number | null;
  scoreChangeText: string;
  latestDriftReason: string;
  scoreHistory: { name: string; score: number }[];
  metrics: {
    errorRate: number;
    blockedRate: number;
    latencyMean: number;
    latencyP95: number;
    refusalRate: number;
    avgSentiment: number;
    topActions: { action: string; count: number; pct: number }[];
    layerBScore?: number;
  };
  metricBreakdown: {
    errorRate: MetricComparison;
    blockedRate: MetricComparison;
    refusalRate: MetricComparison;
    latencyMean: MetricComparison;
    latencyP95: MetricComparison;
    responseLength: MetricComparison;
    toneSentiment: MetricComparison;
    actionMixShift: MetricComparison;
    aiJudgeScores: {
      measured: boolean;
      baseline: number | null;
      current: number | null;
      reasons: string[];
    };
  };
  recentDriftEvents: {
    id: string;
    timestamp: string;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
    cognitiveHealthScore: number;
    sentimentShiftPct: number;
    logsDetails: string;
    remedatedAt?: string;
    remediationNotes?: string;
    evidenceCount: number;
  }[];
  recentActivity: {
    id: string;
    timestamp: string;
    action: string;
    status: 'success' | 'error' | 'blocked';
    latencyMs: number;
  }[];
  remediationTickets: {
    ticketId: string;
    status: string;
    dispatchedAt: string;
    notes: string;
  }[];
}

