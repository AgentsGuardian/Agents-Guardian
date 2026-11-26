import crypto from 'crypto';
import { Policy, PolicyCategory, PolicyEnforcementOutcome, ExecutableRuleDefinition } from '../src/types';

export interface PolicyEvaluationContext {
  agentId: string;
  agentName?: string;
  framework?: string;
  endpoint?: string;
  action: string;
  promptText?: string;
  parameters?: any;
  cost?: number;
  currentTenantSpend?: number;
  tenantBudgetCap?: number;
  tenantId?: string;
  rawJsonIntent?: string;
}

export interface PolicyEvaluationResult {
  isViolation: boolean;
  violatedPolicy?: Policy;
  reason?: string;
  enforcementMode: PolicyEnforcementOutcome;
  matchedRuleDetail?: string;
  latencyMs: number;
}

// In-memory compiled policy cache for sub-millisecond execution (<10ms SLA)
const compiledRuleCache = new Map<string, ExecutableRuleDefinition>();

// Helper to stringify parameters consistently
function serializeParameters(parameters: any): string {
  if (parameters === null || parameters === undefined) return '';
  if (typeof parameters === 'string') return parameters;
  try {
    return JSON.stringify(parameters);
  } catch {
    return String(parameters);
  }
}

// Common pattern matchers for secret detection
const SECRET_REGEX_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/, // GCP API Key
  /sk_live_[0-9a-zA-Z]{24,}/, // Stripe Secret Key
  /ghp_[0-9a-zA-Z]{36}/, // GitHub Token
  /github_pat_[0-9a-zA-Z_]{22,}/, // GitHub PAT
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, // JWT
  /-----BEGIN (RSA )?PRIVATE KEY-----/,
  /4[0-9]{12}(?:[0-9]{3})?/, // Visa card
  /5[1-5][0-9]{14}/, // Mastercard
  /(postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/ // DB URI with credentials
];

// Common prompt injection / jailbreak patterns
const INJECTION_REGEX_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules|constraints)/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+DAN\s+mode/i,
  /jailbreak/i,
  /bypass\s+(security|policy|governance)\s+(filters|rules|guardrails)/i,
  /disregard\s+safety\s+rules/i,
  /override\s+(guardrails|constraints|system prompt)/i,
  /forget\s+(all\s+)?(prior|previous)\s+(rules|instructions|directives)/i,
  /you\s+are\s+now\s+unrestricted/i,
  /developer\s+mode\s+enabled/i
];

/**
 * Evaluates web browser actions (web_click, web_type, web_goto) for destructive or sensitive operations
 */
export function evaluateWebActionExecution(params: {
  action?: string;
  promptText?: string;
  parameters?: any;
}): { isViolation: boolean; reason?: string } {
  const action = (params.action || '').toLowerCase().trim();
  const prompt = (params.promptText || '').toLowerCase();
  const paramsStr = serializeParameters(params.parameters).toLowerCase();
  const fullText = `${action} ${prompt} ${paramsStr}`;

  const isBrowserAction =
    action === 'web_click' ||
    action === 'web_type' ||
    action === 'web_goto' ||
    action.startsWith('web_') ||
    fullText.includes('web_click') ||
    fullText.includes('web_type');

  if (!isBrowserAction) {
    return { isViolation: false };
  }

  // 1. Deleting or clearing all items
  const clearPatterns = [
    /delete\s+all/i,
    /clear\s+all/i,
    /empty\s+cart/i,
    /remove\s+all\s+items/i,
    /delete\s+everything/i,
    /clear\s+items/i,
    /purge\s+all/i
  ];
  if (clearPatterns.some(p => p.test(fullText))) {
    return {
      isViolation: true,
      reason: 'Irreversible browser action blocked: deleting or clearing all items.'
    };
  }

  // 2. Deleting an account
  const accountDeletionPatterns = [
    /delete\s+(my\s+)?account/i,
    /close\s+(my\s+)?account/i,
    /terminate\s+(my\s+)?account/i,
    /remove\s+account/i,
    /deactivate\s+account/i
  ];
  if (accountDeletionPatterns.some(p => p.test(fullText))) {
    return {
      isViolation: true,
      reason: 'Irreversible browser action blocked: deleting or terminating an account.'
    };
  }

  // 3. Placing an order or submitting payment
  const paymentPatterns = [
    /buy\s+now/i,
    /place\s+(your\s+)?order/i,
    /proceed\s+to\s+checkout/i,
    /complete\s+(your\s+)?purchase/i,
    /confirm\s+(and\s+)?pay/i,
    /pay\s+now/i,
    /submit\s+order/i,
    /authorize\s+payment/i,
    /checkout/i
  ];
  if (paymentPatterns.some(p => p.test(fullText))) {
    return {
      isViolation: true,
      reason: 'Sensitive financial browser action blocked: placing an order or submitting payment.'
    };
  }

  // 4. Changing a password
  const passwordChangePatterns = [
    /change\s+(my\s+)?password/i,
    /reset\s+(my\s+)?password/i,
    /update\s+(my\s+)?password/i,
    /new\s+password/i
  ];
  if (passwordChangePatterns.some(p => p.test(fullText))) {
    return {
      isViolation: true,
      reason: 'Sensitive credential browser action blocked: changing or updating a password.'
    };
  }

  // 5. Typing personal data (SSN, Aadhaar, passport, card, bank numbers, passwords)
  const sensitivePiiPatterns = [
    /\bssn\b/i,
    /social\s+security(\s+number)?/i,
    /aadhaar/i,
    /passport(\s+number)?/i,
    /credit\s+card/i,
    /debit\s+card/i,
    /card\s+number/i,
    /bank\s+account/i,
    /routing\s+number/i,
    /\bcvv\b/i,
    /\bcvc\b/i,
    /account\s+number/i,
    /\bpassword\b/i,
    /\bpasswd\b/i
  ];
  if (action === 'web_type' || fullText.includes('type')) {
    if (sensitivePiiPatterns.some(p => p.test(fullText))) {
      return {
        isViolation: true,
        reason: 'Sensitive PII / credential browser form submission blocked: detected SSN, Aadhaar, passport, financial card, or password data.'
      };
    }
  }

  return { isViolation: false };
}

/**
 * Compiles a policy definition into a structured, validated, executable rule definition
 */
export function compilePolicyToExecutableRule(policy: Policy): ExecutableRuleDefinition {
  const code = (policy.code || policy.id || '').trim().toUpperCase();
  const name = (policy.name || '').trim();
  const desc = (policy.description || '').trim();
  const threshold = (policy.threshold || '').trim();
  const blastRadius = (policy.blastRadius || '').trim();
  const category: PolicyCategory = policy.category || 'security';

  const fullText = `${code} ${name} ${desc} ${threshold} ${blastRadius}`.toLowerCase();

  // 1. Determine Enforcement Outcome Mode
  let enforcementMode: PolicyEnforcementOutcome = 'DENY';
  const isKillSwitchConfigured =
    category === 'security' ||
    fullText.includes('kill-switch') ||
    fullText.includes('kill switch') ||
    fullText.includes('zero-trust') ||
    fullText.includes('suspend') ||
    fullText.includes('halt instantly') ||
    fullText.includes('isolate & halt') ||
    fullText.includes('strict halt') ||
    fullText.includes('halt <') ||
    threshold.toLowerCase().includes('halt') ||
    code.startsWith('POL-SEC') ||
    code === 'POL-WEB-01';

  if (isKillSwitchConfigured) {
    enforcementMode = 'KILL_SWITCH';
  } else if (category === 'finance') {
    enforcementMode = 'THROTTLE';
  } else if (
    threshold.toLowerCase().includes('warn') ||
    threshold.toLowerCase().includes('audit') ||
    threshold.toLowerCase().includes('notify') ||
    fullText.includes('flag & notify') ||
    fullText.includes('warn on')
  ) {
    enforcementMode = 'WARN';
  }

  const rule: ExecutableRuleDefinition = {
    enforcementMode,
    actionsDenied: [],
    actionsAllowed: [],
    actionPatterns: [],
    endpointsDenied: [],
    endpointsAllowed: [],
    agentsDenied: [],
    agentsAllowed: [],
    forbiddenKeywords: [],
    regexPatterns: [],
    requiredParameters: [],
    forbiddenParameters: [],
    isWebActionProtection: false,
    checkSecrets: false,
    checkPromptInjection: false,
    compiledAt: new Date().toISOString()
  };

  // 2. Check for explicit rules provided on policy object
  if (policy.rules && typeof policy.rules === 'object') {
    if (Array.isArray(policy.rules.actionsDenied)) rule.actionsDenied = [...policy.rules.actionsDenied.map(a => a.toLowerCase())];
    if (Array.isArray(policy.rules.actionsAllowed)) rule.actionsAllowed = [...policy.rules.actionsAllowed.map(a => a.toLowerCase())];
    if (Array.isArray(policy.rules.actionPatterns)) rule.actionPatterns = [...policy.rules.actionPatterns];
    if (Array.isArray(policy.rules.agentsDenied)) rule.agentsDenied = [...policy.rules.agentsDenied];
    if (Array.isArray(policy.rules.agentsAllowed)) rule.agentsAllowed = [...policy.rules.agentsAllowed];
    if (Array.isArray(policy.rules.endpointsDenied)) rule.endpointsDenied = [...policy.rules.endpointsDenied];
    if (Array.isArray(policy.rules.endpointsAllowed)) rule.endpointsAllowed = [...policy.rules.endpointsAllowed];
    if (Array.isArray(policy.rules.forbiddenKeywords)) rule.forbiddenKeywords = [...policy.rules.forbiddenKeywords];
    if (Array.isArray(policy.rules.requiredParameters)) rule.requiredParameters = [...policy.rules.requiredParameters];
    if (Array.isArray(policy.rules.forbiddenParameters)) rule.forbiddenParameters = [...policy.rules.forbiddenParameters];
    if (typeof policy.rules.maxCostUsd === 'number') rule.maxCostUsd = policy.rules.maxCostUsd;
    if (policy.rules.enforcementMode) rule.enforcementMode = policy.rules.enforcementMode;
    if (typeof policy.rules.isWebActionProtection === 'boolean') rule.isWebActionProtection = policy.rules.isWebActionProtection;
  }

  // 3. Check for explicit JSON or pseudo-DSL in description
  const jsonMatch = desc.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.deny_actions || parsed.actionsDenied)) {
        rule.actionsDenied = (parsed.deny_actions || parsed.actionsDenied).map((a: string) => String(a).toLowerCase());
      }
      if (Array.isArray(parsed.allow_actions || parsed.actionsAllowed)) {
        rule.actionsAllowed = (parsed.allow_actions || parsed.actionsAllowed).map((a: string) => String(a).toLowerCase());
      }
      if (Array.isArray(parsed.deny_agents || parsed.agentsDenied)) {
        rule.agentsDenied = (parsed.deny_agents || parsed.agentsDenied).map((a: string) => String(a));
      }
      if (Array.isArray(parsed.allow_agents || parsed.agentsAllowed)) {
        rule.agentsAllowed = (parsed.allow_agents || parsed.agentsAllowed).map((a: string) => String(a));
      }
      if (typeof parsed.max_cost === 'number') {
        rule.maxCostUsd = parsed.max_cost;
      }
      if (parsed.enforcement_mode) {
        rule.enforcementMode = parsed.enforcement_mode;
      }
    } catch {
      // Ignore JSON parse errors, proceed to natural language parsing
    }
  }

  // 4. Web Action Protection
  if (
    code === 'POL-WEB-01' ||
    blastRadius.toLowerCase().includes('browser') ||
    blastRadius.toLowerCase().includes('web action') ||
    fullText.includes('web_click') ||
    fullText.includes('web_type') ||
    fullText.includes('buy now') ||
    fullText.includes('sensitive web action') ||
    fullText.includes('checkout')
  ) {
    rule.isWebActionProtection = true;
  }

  // 5. Shell & Command Execution Protection (POL-SEC-02 and custom shell rules)
  if (
    code === 'POL-SEC-02' ||
    fullText.includes('shell') ||
    fullText.includes('bash') ||
    fullText.includes('command execution') ||
    fullText.includes('terminal') ||
    fullText.includes('powershell') ||
    fullText.includes('ssh') ||
    fullText.includes('system process')
  ) {
    rule.actionsDenied!.push('bash', 'sh', 'zsh', 'ssh', 'cmd', 'powershell', 'exec', 'system', 'spawn', 'run_command', 'shell_exec');
    rule.actionPatterns!.push(
      '\\b(bash|sh|zsh|ssh|sudo|rm\\s+-rf|chmod|chown)\\b',
      'shell\\.exec',
      'system_command',
      'exec_shell'
    );
  }

  // 6. Database Access & Mutation Protection (POL-SEC-01 and custom database rules)
  if (
    code === 'POL-SEC-01' ||
    blastRadius.toLowerCase().includes('database') ||
    fullText.includes('database access') ||
    fullText.includes('drop table') ||
    fullText.includes('truncate') ||
    fullText.includes('delete from') ||
    fullText.includes('purge_records') ||
    fullText.includes('delete_inactive_leads') ||
    fullText.includes('erp compliance context')
  ) {
    rule.actionPatterns!.push(
      'drop\\s+table',
      'truncate\\s+table',
      'truncate',
      'delete\\s+from',
      'alter\\s+table',
      'purge_records',
      'delete_inactive_leads',
      'delete_customer_leads',
      'db\\.write',
      'db_drop',
      'db_delete'
    );
    if (code === 'POL-SEC-01' || fullText.includes('erp compliance')) {
      rule.requiredParameters!.push('erp_compliance_approval');
    }
  }

  // 7. Destructive Actions & Cloud Resource Protection (General Purge / Delete / Format / IAM actions)
  const actionListPatterns = [
    /(?:block|deny|halt|restrict|prevent|prohibit)\s+(?:actions?|operations?|commands?)?\s*[:\-]?\s*([a-zA-Z0-9_:\*,-]+(?:\s*,\s*[a-zA-Z0-9_:\*,-]+)*)/gi,
    /(?:prohibits?|blocks?|prevents?)\s+(?:all\s+)?(?:agent\s+)?operations?\s+that\s+delete[^:]*:\s*([a-zA-Z0-9_:\*,-]+(?:\s*,\s*[a-zA-Z0-9_:\*,-]+)*)/gi,
    /['"`]([a-zA-Z0-9_-]+:[a-zA-Z0-9_*.-]+)['"`]/gi,
    /\b([a-zA-Z0-9_-]+:[a-zA-Z0-9_*.-]+)\b/gi,
    /(?:action|command)\s+['"`]([a-zA-Z0-9_.*:-]+)['"`]/gi
  ];

  for (const pat of actionListPatterns) {
    const matches = desc.matchAll(pat);
    for (const match of matches) {
      const matchedStr = match[1];
      if (!matchedStr) continue;
      const tokens = matchedStr.split(/[\s,]+/);
      for (const token of tokens) {
        const clean = token.replace(/['"`:.]*$/, '').replace(/^['"`]+/, '').trim();
        if (clean && clean.length > 2 && !['action', 'actions', 'command', 'commands', 'all', 'the', 'that', 'delete', 'and', 'for', 'with', 'operations'].includes(clean.toLowerCase())) {
          if (clean.includes('*')) {
            const regexSafe = clean.replace(/\*/g, '.*');
            if (!rule.actionPatterns!.includes(`^${regexSafe}$`)) {
              rule.actionPatterns!.push(`^${regexSafe}$`);
            }
          } else {
            const lower = clean.toLowerCase();
            if (!rule.actionsDenied!.includes(lower)) {
              rule.actionsDenied!.push(lower);
            }
          }
        }
      }
    }
  }

  // 7. Access Control Matchers (Agents, Endpoints)
  // Check for allowed agents: "allow only agent [ID]", "restricted to agent [ID]", "agent: [ID]"
  const agentAllowMatch = desc.match(/(?:allow only|restricted to|authorized for)\s+agent[:\s]+['"]?([A-Za-z0-9_-]+)['"]?/i);
  if (agentAllowMatch && agentAllowMatch[1]) {
    rule.agentsAllowed!.push(agentAllowMatch[1]);
  }
  const agentDenyMatch = desc.match(/(?:deny|block|prohibit|forbid)\s+agent[:\s]+['"]?([A-Za-z0-9_-]+)['"]?/i);
  if (agentDenyMatch && agentDenyMatch[1]) {
    rule.agentsDenied!.push(agentDenyMatch[1]);
  }

  // Check for blast radius agent scoping (e.g. "Agent: GA-101")
  const blastAgentMatch = blastRadius.match(/Agent[:\s]+([A-Za-z0-9_-]+)/i);
  if (blastAgentMatch && blastAgentMatch[1]) {
    rule.agentsDenied!.push(blastAgentMatch[1]);
  }

  // Check for endpoints: "restrict endpoint /api/foo", "block /api/bar"
  const endpointMatch = desc.match(/(?:endpoint|path|url)[:\s]+['"]?([/A-Za-z0-9_.*-]+)['"]?/i);
  if (endpointMatch && endpointMatch[1]) {
    rule.endpointsDenied!.push(endpointMatch[1]);
  }

  // 8. Spending & Financial Thresholds (POL-FIN-01, POL-FIN-02, custom cost caps)
  const costRegex = /\$([0-9]+(?:\.[0-9]+)?)/g;
  const costMatches = [...threshold.matchAll(costRegex), ...desc.matchAll(costRegex), ...name.matchAll(costRegex)];
  if (costMatches.length > 0) {
    const extractedCosts = costMatches.map(m => parseFloat(m[1])).filter(n => !isNaN(n));
    if (extractedCosts.length > 0) {
      if (code === 'POL-FIN-02' || fullText.includes('single request') || fullText.includes('per request')) {
        rule.maxCostUsd = Math.min(...extractedCosts);
      } else if (code === 'POL-FIN-01' || fullText.includes('session') || fullText.includes('budget cap')) {
        rule.maxCostUsd = Math.max(...extractedCosts);
      } else {
        rule.maxCostUsd = extractedCosts[0];
      }
    }
  }

  if (code === 'POL-FIN-02' && !rule.maxCostUsd) {
    rule.maxCostUsd = 5.0; // Standard $5.00 single request cap
  }
  if (code === 'POL-FIN-01' && !rule.maxCostUsd) {
    rule.maxCostUsd = 50.0; // Standard $50.00 session budget cap
  }

  // 9. Prompt Injection & Secrets Detection
  if (
    category === 'security' ||
    fullText.includes('prompt injection') ||
    fullText.includes('injection') ||
    fullText.includes('jailbreak') ||
    fullText.includes('secret') ||
    fullText.includes('credential') ||
    fullText.includes('api key')
  ) {
    rule.checkPromptInjection = true;
    rule.checkSecrets = true;
  }

  // 10. Ethics & Cognitive Drift (POL-ETH-01, POL-ETH-02)
  const pctMatch = fullText.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (pctMatch && pctMatch[1]) {
    rule.driftThresholdPct = parseFloat(pctMatch[1]);
  } else if (code === 'POL-ETH-01') {
    rule.driftThresholdPct = 10.0;
  } else if (code === 'POL-ETH-02') {
    rule.driftThresholdPct = 15.0;
  }

  if (category === 'ethics' || fullText.includes('bias') || fullText.includes('demographic') || fullText.includes('sentiment')) {
    rule.disallowedSentimentKeywords = [
      'demographic_target',
      'sentiment_shift_override',
      'bias_injection',
      'discriminate',
      'protected_class_filter',
      'exclude_demographic'
    ];
  }

  // Extract explicit forbidden keyword quotes: 'foo' or "foo"
  const quotedTerms = desc.match(/['"]([^'"]{3,40})['"]/g);
  if (quotedTerms) {
    for (const q of quotedTerms) {
      const term = q.replace(/['"]/g, '').trim().toLowerCase();
      if (!term.includes(' ') && term.length > 2 && !rule.actionsDenied!.includes(term)) {
        rule.forbiddenKeywords!.push(term);
      }
    }
  }

  // Cache compiled rule
  compiledRuleCache.set(policy.id || policy.code, rule);
  return rule;
}

/**
 * Evaluates a single compiled policy rule against the incoming execution context
 */
export function evaluatePolicyRule(
  policy: Policy,
  rule: ExecutableRuleDefinition,
  context: PolicyEvaluationContext
): { isViolation: boolean; reason?: string; outcome: PolicyEnforcementOutcome; matchedDetail?: string } {
  const action = (context.action || '').trim();
  const lowerAction = action.toLowerCase();
  const endpoint = (context.endpoint || '').trim();
  const lowerEndpoint = endpoint.toLowerCase();
  const prompt = (context.promptText || '').trim();
  const lowerPrompt = prompt.toLowerCase();
  const paramsStr = serializeParameters(context.parameters);
  const lowerParamsStr = paramsStr.toLowerCase();
  const fullPayloadStr = `${lowerAction} ${lowerEndpoint} ${lowerPrompt} ${lowerParamsStr}`;
  const outcome = rule.enforcementMode || 'DENY';

  // 1. Access Control: Agents Denied
  if (rule.agentsDenied && rule.agentsDenied.length > 0) {
    const isDenied = rule.agentsDenied.some(
      deniedAgent =>
        deniedAgent.toLowerCase() === context.agentId.toLowerCase() ||
        (context.agentName && deniedAgent.toLowerCase() === context.agentName.toLowerCase())
    );
    if (isDenied) {
      return {
        isViolation: true,
        reason: `Agent '${context.agentId}' is forbidden by access control policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: `agentsDenied: ${context.agentId}`
      };
    }
  }

  // 2. Access Control: Agents Allowed (Allowlist check)
  if (rule.agentsAllowed && rule.agentsAllowed.length > 0) {
    const isAllowed = rule.agentsAllowed.some(
      allowedAgent =>
        allowedAgent.toLowerCase() === context.agentId.toLowerCase() ||
        (context.agentName && allowedAgent.toLowerCase() === context.agentName.toLowerCase())
    );
    if (!isAllowed) {
      return {
        isViolation: true,
        reason: `Agent '${context.agentId}' is not authorized to execute this operation under policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: `agentsAllowed: not in [${rule.agentsAllowed.join(', ')}]`
      };
    }
  }

  // 3. Access Control: Endpoints Denied
  if (rule.endpointsDenied && rule.endpointsDenied.length > 0) {
    const isEndpointBlocked = rule.endpointsDenied.some(deniedEp => {
      const cleanEp = deniedEp.toLowerCase();
      if (cleanEp.endsWith('*')) {
        return lowerEndpoint.startsWith(cleanEp.slice(0, -1));
      }
      return lowerEndpoint === cleanEp || lowerEndpoint.includes(cleanEp);
    });
    if (isEndpointBlocked) {
      return {
        isViolation: true,
        reason: `Endpoint '${endpoint}' access is restricted by policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: `endpointsDenied: ${endpoint}`
      };
    }
  }

  // 4. Web Browser Protection (POL-WEB-01 and custom web actions)
  if (rule.isWebActionProtection) {
    const webCheck = evaluateWebActionExecution({
      action: context.action,
      promptText: context.promptText,
      parameters: context.parameters
    });
    if (webCheck.isViolation) {
      return {
        isViolation: true,
        reason: webCheck.reason || `Sensitive or irreversible web action halted by ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: `isWebActionProtection: ${webCheck.reason}`
      };
    }
  }

  // 5. Actions Denied (Exact & Prefix)
  if (rule.actionsDenied && rule.actionsDenied.length > 0) {
    const isActionDenied = rule.actionsDenied.some(deniedAct => {
      return (
        lowerAction === deniedAct ||
        lowerAction.startsWith(`${deniedAct}.`) ||
        lowerAction.startsWith(`${deniedAct}_`) ||
        lowerAction.includes(deniedAct)
      );
    });
    if (isActionDenied) {
      return {
        isViolation: true,
        reason: `Action '${action}' is prohibited by policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: `actionsDenied: ${action}`
      };
    }
  }

  // 6. Action Regex Patterns (e.g. drop table, rm -rf, truncate)
  if (rule.actionPatterns && rule.actionPatterns.length > 0) {
    for (const patternStr of rule.actionPatterns) {
      try {
        const regex = new RegExp(patternStr, 'i');
        if (regex.test(action) || regex.test(fullPayloadStr)) {
          // If policy requires approval flag context (e.g. POL-SEC-01)
          if (rule.requiredParameters && rule.requiredParameters.length > 0) {
            let hasAllRequired = true;
            for (const reqParam of rule.requiredParameters) {
              const paramVal = context.parameters ? (context.parameters as any)[reqParam] : undefined;
              if (paramVal !== true && paramVal !== 'true') {
                hasAllRequired = false;
                break;
              }
            }
            if (hasAllRequired) {
              continue; // Authorized with compliance approval context
            }
          }
          return {
            isViolation: true,
            reason: `Action pattern matched prohibited rule (${patternStr}) under policy ${policy.code}: ${policy.name}`,
            outcome,
            matchedDetail: `actionPatterns: ${patternStr}`
          };
        }
      } catch {}
    }
  }

  // 7. Forbidden Keywords
  if (rule.forbiddenKeywords && rule.forbiddenKeywords.length > 0) {
    for (const kw of rule.forbiddenKeywords) {
      if (fullPayloadStr.includes(kw.toLowerCase())) {
        return {
          isViolation: true,
          reason: `Restricted keyword '${kw}' detected under policy ${policy.code}: ${policy.name}`,
          outcome,
          matchedDetail: `forbiddenKeywords: ${kw}`
        };
      }
    }
  }

  // 8. Prompt Injection & Jailbreak Checks
  if (rule.checkPromptInjection) {
    const isInjection = INJECTION_REGEX_PATTERNS.some(p => p.test(fullPayloadStr));
    if (isInjection) {
      return {
        isViolation: true,
        reason: `Prompt injection / instruction override pattern detected under policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: 'checkPromptInjection'
      };
    }
  }

  // 9. Secrets & PII Checks
  if (rule.checkSecrets) {
    const hasSecrets = SECRET_REGEX_PATTERNS.some(p => p.test(fullPayloadStr));
    if (hasSecrets) {
      return {
        isViolation: true,
        reason: `Unmasked API credential, secret key, or PII pattern detected under policy ${policy.code}: ${policy.name}`,
        outcome,
        matchedDetail: 'checkSecrets'
      };
    }
  }

  // 10. Financial / Budget Limits
  const effectiveCost = typeof context.cost === 'number' ? context.cost : 0.05;
  const currentSpend = typeof context.currentTenantSpend === 'number' ? context.currentTenantSpend : 0.0;
  const budgetCap = typeof context.tenantBudgetCap === 'number' ? context.tenantBudgetCap : 500.0;

  // Single request cost limit
  if (rule.maxCostUsd && rule.maxCostUsd > 0) {
    if (policy.code === 'POL-FIN-01' || rule.enforcementMode === 'THROTTLE') {
      if (effectiveCost + currentSpend > budgetCap) {
        return {
          isViolation: true,
          reason: `Request cost ($${effectiveCost.toFixed(2)}) plus current spend ($${currentSpend.toFixed(2)}) exceeds tenant budget cap ($${budgetCap.toFixed(2)}) under policy ${policy.code}`,
          outcome: 'THROTTLE',
          matchedDetail: `budgetCapExceeded: $${effectiveCost + currentSpend} > $${budgetCap}`
        };
      }
    }
    if (effectiveCost > rule.maxCostUsd) {
      return {
        isViolation: true,
        reason: `Request cost ($${effectiveCost.toFixed(2)}) exceeds single request threshold ($${rule.maxCostUsd.toFixed(2)}) defined by policy ${policy.code}: ${policy.name}`,
        outcome: 'THROTTLE',
        matchedDetail: `maxCostUsdExceeded: $${effectiveCost} > $${rule.maxCostUsd}`
      };
    }
  }

  // Check fraudulent zero-cost bypass on non-empty payload
  const charLength = fullPayloadStr.trim().length;
  if (context.cost === 0 && charLength > 20 && (policy.category === 'finance' || policy.code === 'POL-FIN-02')) {
    return {
      isViolation: true,
      reason: `Fraudulent zero-cost bypass claim flagged for ${charLength} char payload under policy ${policy.code}`,
      outcome: 'THROTTLE',
      matchedDetail: 'budgetBypassAttempt'
    };
  }

  // 11. Ethics & Sentiment Drift Keywords
  if (rule.disallowedSentimentKeywords && rule.disallowedSentimentKeywords.length > 0) {
    const hasEthicalViolation = rule.disallowedSentimentKeywords.some(kw => fullPayloadStr.includes(kw));
    if (hasEthicalViolation) {
      return {
        isViolation: true,
        reason: `Ethical drift / sentiment bias keyword detected under policy ${policy.code}: ${policy.name}`,
        outcome: rule.enforcementMode || 'WARN',
        matchedDetail: 'disallowedSentimentKeywords'
      };
    }
  }

  return { isViolation: false, outcome: 'DENY' };
}

/**
 * Evaluates all active policies against an execution context in real time (<10ms SLA)
 */
export function evaluateAllPolicies(
  policies: Policy[],
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  const startTime = process.hrtime();

  // Filter strictly to enabled policies only
  const activePolicies = policies.filter(p => p.enabled);

  for (const policy of activePolicies) {
    let rule = compiledRuleCache.get(policy.id || policy.code);
    if (!rule || !rule.compiledAt) {
      rule = compilePolicyToExecutableRule(policy);
    }

    const evalResult = evaluatePolicyRule(policy, rule, context);
    if (evalResult.isViolation) {
      const diff = process.hrtime(startTime);
      const latencyMs = Math.max(1, Math.round((diff[0] * 1000 + diff[1] / 1e6) * 10) / 10);

      return {
        isViolation: true,
        violatedPolicy: policy,
        reason: evalResult.reason,
        enforcementMode: evalResult.outcome,
        matchedRuleDetail: evalResult.matchedDetail,
        latencyMs
      };
    }
  }

  const diff = process.hrtime(startTime);
  const latencyMs = Math.max(1, Math.round((diff[0] * 1000 + diff[1] / 1e6) * 10) / 10);

  return {
    isViolation: false,
    enforcementMode: 'DENY',
    latencyMs
  };
}

/**
 * Invalidates the compiled cache for a policy or clears all
 */
export function invalidatePolicyCache(policyId?: string) {
  if (policyId) {
    compiledRuleCache.delete(policyId);
  } else {
    compiledRuleCache.clear();
  }
}
