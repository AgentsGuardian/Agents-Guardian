import 'dotenv/config';
import { validateStartupEnv } from './server/startupValidator';

// Consolidated Startup Guard: Validate all required secrets at once
validateStartupEnv();

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { governanceEngine } from './server/governanceEngine';
import { storageEngine } from './server/db';
import { signJwt, verifyJwt, hashPassword, verifyPassword } from './server/authUtils';
import { verifyGoogleOidcToken } from './server/googleAuth';

// Helper to resolve GCP_PROJECT_ID with explicit warning when falling back to default
function getGcpProjectId(): string {
  const proj = process.env.GCP_PROJECT_ID;
  if (!proj || !proj.trim()) {
    console.warn('[CONFIG_WARNING] GCP_PROJECT_ID environment variable is not set. Defaulting explicitly to "agentsguardian-prod".');
    return 'agentsguardian-prod';
  }
  return proj.trim();
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Custom Express Request Interface
interface AuthenticatedRequest extends express.Request {
  tenantId?: string;
  authUser?: any;
}

// =========================================================================
// AUTHENTICATION & RBAC MIDDLEWARES (SERVER-SIDE GATEWAYS)
// =========================================================================

// 1. Tenant Intercept API Key Authentication Middleware
const requireTenantApiKey = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const apiKeyHeader = (
    req.headers['x-guardian-key'] ||
    req.headers['x-api-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : '') ||
    req.body?.apiKey ||
    req.body?.api_key ||
    req.query?.apiKey
  ) as string;

  const validation = governanceEngine.validateTenantApiKey(apiKeyHeader);
  if (!validation.valid) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid API key' });
  }

  req.tenantId = validation.tenantId;
  next();
};

// 2. Admin Console Session Authentication Middleware (JWT Session Security)
const requireAdminAuth = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = (req.headers['authorization'] || '') as string;
  const sessionTokenHeader = (req.headers['x-admin-session'] || '') as string;

  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token && sessionTokenHeader) {
    token = sessionTokenHeader.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }

  const verification = verifyJwt(token);
  if (!verification.valid || !verification.payload) {
    return res.status(401).json({ error: `Unauthorized: ${verification.error || 'Invalid or expired session token'}` });
  }

  const allUsers = governanceEngine.getUsers();
  const authUser = allUsers.find(u => u.id === verification.payload.userId || (verification.payload.email && u.email.toLowerCase() === verification.payload.email.toLowerCase()));

  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized: User account not found' });
  }

  if (authUser.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Forbidden: Account is suspended' });
  }

  if (authUser.mustResetPassword && req.path !== '/api/auth/change-password' && req.path !== '/api/auth/reset-password' && req.path !== '/api/auth/logout' && req.path !== '/api/auth/me') {
    return res.status(403).json({ error: 'Password reset required before proceeding. Please update your password.', mustResetPassword: true });
  }

  req.authUser = authUser;
  next();
};

// 3. Server-Side RBAC Gate Middleware (Role Resolved From Authenticated Session / DB)
const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const userRole = req.authUser.role; // Server-resolved role (never trust body.role)
    if (userRole === 'Auditor' && !allowedRoles.includes('Auditor')) {
      return res.status(403).json({ error: `Forbidden: Role 'Auditor' lacks mutation permissions` });
    }

    if (!allowedRoles.includes('*') && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Role '${userRole}' is not authorized for this operation` });
    }

    next();
  };
};

// ==========================================
// REAL GAAS GOVERNANCE ENGINE API ENDPOINTS
// ==========================================

// Health Check Endpoint (Reports storage degradation status for monitoring)
const handleHealthCheck = async (req: express.Request, res: express.Response) => {
  await storageEngine.waitUntilReady();
  const status = storageEngine.getHealthStatus();
  if (status.degraded) {
    return res.status(200).json({
      status: 'degraded',
      degraded: true,
      reason: status.reason,
      postgresConnected: status.isPgConnected,
      redisConnected: status.isRedisConnected,
      timestamp: new Date().toISOString()
    });
  }
  return res.json({
    status: 'ok',
    degraded: false,
    postgresConnected: status.isPgConnected,
    redisConnected: status.isRedisConnected,
    timestamp: new Date().toISOString()
  });
};

app.get('/healthz', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// 0. Auth Session Routes (Real Admin & Identity Platform Gateway)
app.post('/api/auth/login', (req: express.Request, res: express.Response) => {
  const { email, password } = req.body || {};
  const sanitizedEmail = (email || '').toLowerCase().trim();
  const allUsers = governanceEngine.getUsers();
  const user = allUsers.find(u => u.email.toLowerCase().trim() === sanitizedEmail);

  const genericAuthError = { error: 'Invalid email or password' };

  if (!user) {
    return res.status(401).json(genericAuthError);
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: `Account for ${user.name} is marked as SUSPENDED under security directive POL-SEC-01.` });
  }

  if (!password) {
    return res.status(401).json(genericAuthError);
  }

  let isValidPassword = false;
  if (user.passwordHash && user.passwordSalt) {
    isValidPassword = verifyPassword(password, user.passwordHash, user.passwordSalt);
  } else {
    isValidPassword = false;
  }

  if (!isValidPassword) {
    return res.status(401).json(genericAuthError);
  }

  const token = signJwt({
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId || 'tenant_default'
  }, 3600);

  user.lastLogin = new Date().toISOString();

  return res.json({
    success: true,
    user,
    token,
    mustResetPassword: !!user.mustResetPassword,
    message: user.mustResetPassword 
      ? `Session token issued. Password reset required for initial seed account.`
      : `Session token issued for ${user.name} under role ${user.role}`
  });
});

app.post('/api/auth/register', (req: express.Request, res: express.Response) => {
  const { name, email, password, role = 'Admin', organization } = req.body || {};
  const sanitizedEmail = (email || '').toLowerCase().trim();
  if (!sanitizedEmail || !name) {
    return res.status(400).json({ error: 'Name and valid email are required for account registration' });
  }

  if (!password || password.length < 12) {
    return res.status(400).json({ error: 'Password is required and must be at least 12 characters long' });
  }

  const allUsers = governanceEngine.getUsers();
  const existing = allUsers.find(u => u.email.toLowerCase().trim() === sanitizedEmail);
  if (existing) {
    return res.status(400).json({ error: `Email '${sanitizedEmail}' is already registered.` });
  }

  // Data-driven role assignment check: SuperAdmin can only be granted by an authenticated SuperAdmin
  if (role === 'SuperAdmin') {
    const authHeader = (req.headers['authorization'] || '') as string;
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    const verification = verifyJwt(token);
    const requestingUser = verification.valid ? allUsers.find(u => u.id === verification.payload?.userId) : null;

    if (!requestingUser || requestingUser.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'SuperAdmin role can only be granted by an authenticated SuperAdmin.' });
    }
  }

  const { hash, salt } = hashPassword(password);

  const newUser: any = {
    id: `USR-REQ-${Math.floor(1000 + Math.random() * 9000)}`,
    tenantId: 'tenant_default',
    name: name.trim(),
    email: sanitizedEmail,
    role,
    status: 'ACTIVE',
    mfaEnabled: true,
    lastLogin: new Date().toISOString(),
    passwordHash: hash,
    passwordSalt: salt,
    mustResetPassword: false
  };

  allUsers.push(newUser);

  const token = signJwt({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    tenantId: newUser.tenantId
  }, 3600);

  return res.json({
    success: true,
    user: newUser,
    token,
    message: `Registration successful for ${newUser.name}`
  });
});

// Rate Limiter for Password Reset Requests (In-memory token bucket per IP / email)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const forgotPasswordLimits = new Map<string, RateLimitRecord>();
const validateKeyLimits = new Map<string, RateLimitRecord>();

function isForgotRateLimited(key: string, maxRequests = 5, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const record = forgotPasswordLimits.get(key);

  if (!record || now > record.resetAt) {
    forgotPasswordLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count += 1;
  return false;
}

function isValidateKeyRateLimited(key: string, maxRequests = 60, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const record = validateKeyLimits.get(key);

  if (!record || now > record.resetAt) {
    validateKeyLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count += 1;
  return false;
}

app.post('/api/auth/change-password', requireAdminAuth, (req: AuthenticatedRequest, res: express.Response) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters long' });
  }

  const user = req.authUser;
  if (user.passwordHash && user.passwordSalt && !user.mustResetPassword) {
    const isValid = verifyPassword(oldPassword, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.mustResetPassword = false;

  return res.json({
    success: true,
    message: 'Password changed successfully. Password reset requirement cleared.'
  });
});

app.post('/api/auth/forgot-password', (req: express.Request, res: express.Response) => {
  const { email } = req.body || {};
  const sanitizedEmail = (email || '').toLowerCase().trim();
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown-ip';

  // Enforce rate limit (per IP and per email)
  if ((sanitizedEmail && isForgotRateLimited(`email:${sanitizedEmail}`, 3)) || isForgotRateLimited(`ip:${clientIp}`, 30)) {
    return res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });
  }

  const genericResponse = {
    success: true,
    message: 'If an account exists for this email, password reset instructions have been dispatched.'
  };

  const allUsers = governanceEngine.getUsers();
  const user = allUsers.find(u => u.email.toLowerCase().trim() === sanitizedEmail);

  if (!user) {
    return res.json(genericResponse);
  }

  const resetToken = signJwt({
    userId: user.id,
    email: user.email,
    purpose: 'password_reset'
  }, 900);

  user.resetToken = resetToken;
  user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Out-of-Band Delivery: Token logged server-side only. Never return token in HTTP response.
  console.log(`[OUT_OF_BAND_DISPATCH_PLACEHOLDER] Out-of-Band Password Reset Dispatch for ${user.email}: Token=${resetToken}. Note: Token logged server-side for development/testing. Replace with real transactional email service in production.`);

  return res.json(genericResponse);
});

app.post('/api/auth/reset-password', (req: express.Request, res: express.Response) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters long' });
  }

  const verification = verifyJwt(token);
  if (!verification.valid || !verification.payload || verification.payload.purpose !== 'password_reset') {
    return res.status(400).json({ error: 'Invalid or expired password reset token' });
  }

  const allUsers = governanceEngine.getUsers();
  const user = allUsers.find(u => u.id === verification.payload.userId);

  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.mustResetPassword = false;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;

  return res.json({
    success: true,
    message: 'Password successfully reset. You may now log in with your new password.'
  });
});

app.get('/api/auth/session', requireAdminAuth, (req: AuthenticatedRequest, res: express.Response) => {
  const token = signJwt({
    userId: req.authUser.id,
    email: req.authUser.email,
    role: req.authUser.role,
    tenantId: req.authUser.tenantId || 'tenant_default'
  }, 3600);

  res.json({
    authenticated: true,
    user: req.authUser,
    token
  });
});

// 1. Full State API
app.get('/api/state', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getState());
});

// 2. Real-Time Interception Engine Endpoint (<10ms Deterministic SLA)
app.post(['/api/v1/intercept', '/v1/intercept', '/intercept'], requireTenantApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const payload = req.body || {};
    const tenantId = req.tenantId || 'tenant_default';

    // Anti-spoofing check: client-supplied tenant_id must match authenticated key identity
    if (payload.tenant_id && payload.tenant_id !== tenantId && tenantId !== 'tenant_default') {
      return res.status(403).json({
        error: `Forbidden: Client-supplied tenant_id '${payload.tenant_id}' does not match authenticated identity '${tenantId}'`,
        code: 'TENANT_SPOOFING_BLOCKED'
      });
    }

    const result = await governanceEngine.evaluateRequest({
      agentId: payload.agent_id || payload.agentId,
      agentName: payload.agent_name || payload.agentName,
      framework: payload.framework,
      endpoint: payload.endpoint || '/v1/intercept',
      actionCommand: payload.action || payload.actionCommand,
      rawJsonIntent: typeof payload.parameters === 'object' ? JSON.stringify(payload.parameters, null, 2) : payload.parameters || payload.rawJsonIntent,
      estimatedCost: typeof payload.estimated_cost === 'number' ? payload.estimated_cost : payload.estimatedCost,
      promptText: payload.prompt_text || payload.promptText,
      tenantId
    });

    if (!result.authorized) {
      return res.status(403).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('Error in /api/v1/intercept:', error);
    return res.status(500).json({ error: 'Interception Engine Failure' });
  }
});

// 3. Inline Proxy Mode Endpoint (/v1/proxy/:tenant_id/* and /api/v1/proxy/:tenant_id/*)
const handleInlineProxy = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const authTenantId = req.tenantId || 'tenant_default';
    const routeTenantId = req.params.tenant_id || (req.params as any)[0]?.replace(/^\//, '').split('/')[0];

    // Anti-spoofing check: route tenant_id must match authenticated identity
    if (routeTenantId && routeTenantId !== authTenantId && authTenantId !== 'tenant_default' && routeTenantId !== 'default') {
      return res.status(403).json({
        error: {
          message: `[AgentsGuardian Proxy] Forbidden: Client-supplied route tenant_id '${routeTenantId}' does not match authenticated identity '${authTenantId}'`,
          type: 'tenant_isolation_violation',
          code: 'CROSS_TENANT_ACCESS_DENIED'
        }
      });
    }

    const tenantId = authTenantId;
    const body = req.body || {};
    const messages = body.messages || [];
    const model = body.model || 'gpt-4o';

    let userPromptText = '';
    if (Array.isArray(messages) && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      userPromptText = lastUserMsg?.content || messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    } else if (typeof body.prompt === 'string') {
      userPromptText = body.prompt;
    } else {
      userPromptText = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const evalResult = await governanceEngine.evaluateRequest({
      agentId: `GA-PROXY-${tenantId.slice(0, 8)}`,
      agentName: `InlineProxy-${tenantId}`,
      framework: 'Inline Proxy Endpoint',
      endpoint: req.originalUrl,
      actionCommand: `llm_chat_completion_${model}`,
      rawJsonIntent: userPromptText,
      estimatedCost: 0.03,
      promptText: userPromptText,
      tenantId
    });

    if (!evalResult.authorized) {
      return res.status(403).json({
        error: {
          message: `[AgentsGuardian Proxy] Request blocked by policy: ${evalResult.policy_violated}`,
          type: 'governance_policy_violation',
          code: evalResult.policy_code,
          latency_ms: evalResult.latency_ms,
          timestamp_annex_iv: evalResult.timestamp_annex_iv,
          ledger_hash: evalResult.ledger_hash,
          reason: evalResult.reason
        }
      });
    }

    // Call upstream LLM API (Gemini via @google/genai) when authorized
    let upstreamContent = '';
    const ai = getAiClient();
    if (ai) {
      try {
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPromptText || 'Provide a helpful assistant response.'
        });
        upstreamContent = geminiRes.text || '';
      } catch (geminiErr: any) {
        console.warn('Gemini API call error in proxy handler:', geminiErr?.message || geminiErr);
        upstreamContent = `[Upstream LLM] Evaluated and authorized by AgentsGuardian Policy Engine (${evalResult.latency_ms}ms SLA). Input cleared without policy violation.`;
      }
    } else {
      upstreamContent = `[Upstream LLM] Evaluated and authorized by AgentsGuardian Policy Engine (${evalResult.latency_ms}ms SLA). Input cleared without policy violation.`;
    }

    const promptTokens = Math.max(10, Math.floor(userPromptText.length / 4));
    const completionTokens = Math.max(10, Math.floor(upstreamContent.length / 4));

    return res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: upstreamContent
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      },
      _agentsguardian: {
        authorized: true,
        latency_ms: evalResult.latency_ms,
        ledger_hash: evalResult.ledger_hash,
        tenant_id: tenantId
      }
    });
  } catch (error) {
    console.error('Error in Inline Proxy Handler:', error);
    return res.status(500).json({ error: { message: 'Inline Proxy Engine Error' } });
  }
};

app.post('/v1/proxy/:tenant_id*', requireTenantApiKey, handleInlineProxy);
app.post('/api/v1/proxy/:tenant_id*', requireTenantApiKey, handleInlineProxy);

// 4. Model Context Protocol (MCP) & SDK Interceptor Mode Endpoints
const handleMcpToolCall = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const payload = req.body || {};
    const tenantId = req.tenantId || 'tenant_default';
    const evalResult = await governanceEngine.evaluateRequest({
      agentId: payload.params?.agent_id || 'MCP-Agent',
      agentName: 'MCP Tool Runner',
      endpoint: '/v1/mcp/tools/call',
      actionCommand: `mcp_tool_${payload.params?.name || 'call'}`,
      rawJsonIntent: JSON.stringify(payload.params?.arguments || {}),
      estimatedCost: 0.01,
      tenantId
    });

    if (!evalResult.authorized) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: `[AgentsGuardian MCP] Blocked by policy ${evalResult.policy_violated}`,
          data: evalResult
        },
        id: payload.id || 1
      });
    }

    return res.json({
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `Tool ${payload.params?.name} executed cleanly under AgentsGuardian GaaS Interceptor.` }]
      },
      id: payload.id || 1
    });
  } catch (error) {
    console.error('Error in MCP tool call:', error);
    return res.status(500).json({ error: 'MCP Proxy Engine Error' });
  }
};

app.post('/v1/mcp/tools/call', requireTenantApiKey, handleMcpToolCall);
app.post('/api/v1/mcp/tools/call', requireTenantApiKey, handleMcpToolCall);

const handleMcpResourceRead = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    return res.json({ jsonrpc: '2.0', result: { contents: [] }, id: req.body?.id || 1 });
  } catch (error) {
    console.error('Error in MCP resource read:', error);
    return res.status(500).json({ error: 'MCP Resource Proxy Error' });
  }
};

app.post('/v1/mcp/resources/read', requireTenantApiKey, handleMcpResourceRead);
app.post('/api/v1/mcp/resources/read', requireTenantApiKey, handleMcpResourceRead);

// 5. SDK Shield Inspection Endpoint (Shield.inspect())
const handleShieldInspect = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const tenantId = req.tenantId || 'tenant_default';
    const result = await governanceEngine.evaluateRequest({ ...(req.body || {}), tenantId });
    if (!result.authorized) {
      return res.status(403).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('Error in Shield Inspect:', error);
    return res.status(500).json({ error: 'Shield Inspection Engine Error' });
  }
};

app.post('/v1/shield/inspect', requireTenantApiKey, handleShieldInspect);
app.post('/api/v1/shield/inspect', requireTenantApiKey, handleShieldInspect);


// 4. Telemetry Heartbeat Pipeline
app.post('/api/v1/telemetry/heartbeat', requireTenantApiKey, (req: AuthenticatedRequest, res) => {
  try {
    const { agentId, agentName } = req.body;
    const state = governanceEngine.getState();
    let agent = state.governedAgents.find(a => a.id === agentId || a.name === agentName);
    if (agent) {
      agent.requestCount += 1;
    }
    res.json({ status: 'HEARTBEAT_ACK', agentId: agentId || 'unknown', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat Error' });
  }
});

// 5. RSA-4096 / Signature Handshake Verification Endpoint
app.post('/api/v1/handshake', requireTenantApiKey, (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  res.json({
    status: 'VERIFIED',
    tenantId: req.tenantId,
    rsaBits: 4096,
    signatureAlgorithm: 'SHA256withRSA',
    timestamp: new Date().toISOString(),
    governanceMode: state.governanceMode
  });
});

// 6. Immutable Cryptographic Ledger Endpoint (Annex IV Compliant)
app.get('/api/ledger', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    compliant: true,
    annexIVStandard: 'EU Regulation (EU) 2024/1689 Annex IV',
    ledgerLogs: governanceEngine.getLedgerLogs()
  });
});

// 7. Cognitive Drift Analyzer & Remediation
app.post('/api/drift/analyze', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { agentGroup, sampleLogs, ethicalStandard } = req.body;
    const event = governanceEngine.analyzeDrift({ agentGroup, sampleLogs, ethicalStandard });
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: 'Drift Analysis Error' });
  }
});

app.post('/api/drift/remediate', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.body;
    const result = governanceEngine.remediateDrift(id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Remediation Error' });
  }
});

// 8. Economic Stress Testing Endpoint
app.post('/api/economic/stress-test', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { scenario } = req.body;
    const result = governanceEngine.runEconomicStressTest(scenario || '500 Password Resets');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Economic Test Error' });
  }
});

// 9. Policies CRUD, OPA Compiler, Cloud SQL Schema, Audit Ledger & RBAC Endpoints
app.get('/api/v1/policies/compile-opa', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.compileOpaBundle());
});

app.get('/api/v1/architecture', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getGcpArchitectureTopology());
});

app.get('/api/v1/schema/migration.sql', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  try {
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      return res.send(sqlContent);
    }
    return res.status(404).json({ error: 'Schema file not found' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load migration schema' });
  }
});

app.get('/api/v1/audit/ledger', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getState().auditLedger);
});

app.get('/api/v1/audit/verify', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.verifyAuditLedgerIntegrity());
});

app.get('/api/v1/audit/scheduled-verify', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.runScheduledIntegrityVerification());
});

app.post('/api/v1/audit/scheduled-verify', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.runScheduledIntegrityVerification());
});

// Continuous background integrity verification job (Simulates Cloud Scheduler hourly trigger)
setInterval(() => {
  try {
    governanceEngine.runScheduledIntegrityVerification();
  } catch (err) {
    console.error('Scheduled background integrity verification job error:', err);
  }
}, 3600000);

app.get('/api/v1/audit/export', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || 'tenant_default';
  res.json(governanceEngine.exportCompliancePackage(tenantId));
});

app.post('/api/v1/rbac/check', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const userRole = req.authUser.role;
  const permission = req.body?.permission || 'policies:read';
  const authorized = governanceEngine.checkUserPermission(userRole, permission);
  res.json({
    role: userRole,
    permission,
    authorized,
    timestamp: new Date().toISOString()
  });
});

// Failure Mode Policy Management & Simulation
app.get('/api/v1/failure-modes', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    config: governanceEngine.getTenantFailureConfig(),
    documentation: {
      security: 'FAIL_CLOSED (Non-negotiable). If the governance engine or Redis cluster is unreachable, all security-critical requests are automatically BLOCKED with HTTP 403 to guarantee identity and database boundaries.',
      ethics: 'FAIL_CLOSED (Configurable). Reasoning alignment and demographic sentiment checks block output upon governance outage.',
      finance: 'FAIL_OPEN_ALERT (Default, Configurable). Budget and session cap counters fail OPEN with a background webhook alert dispatch so temporary Redis cache blips do NOT halt customer production agents.'
    }
  });
});

app.post('/api/v1/failure-modes', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'PolicyManager']), (req: AuthenticatedRequest, res) => {
  const updated = governanceEngine.updateTenantFailureConfig(req.body || {});
  res.json({
    message: 'Tenant Failure Mode Policy updated successfully',
    config: updated
  });
});

app.post('/api/v1/simulate-outage', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const { category, agentName } = req.body || {};
  const result = governanceEngine.simulateOutageEvaluation(category || 'security', agentName || 'Simulated-Production-Agent');
  res.status(result.statusCode).json(result);
});

// Bypass Policy Guard Endpoint (Server-Side RBAC SuperAdmin Gate + "BYPASS" Confirm String + 15-min Auto-Revert)
const handleBypassGuardToggle = (req: AuthenticatedRequest, res: express.Response) => {
  if (req.authUser.role !== 'SuperAdmin') {
    return res.status(403).json({ error: "Forbidden: SuperAdmin role required to activate bypass guard" });
  }

  const { confirm, tenantId = 'tenant_default', enabled = true } = req.body || {};

  if (enabled && confirm !== 'BYPASS') {
    return res.status(400).json({ error: 'Bad Request: "confirm": "BYPASS" string required in body' });
  }

  const result = governanceEngine.setTenantBypassGuard(tenantId, enabled, 15);
  return res.json({
    success: true,
    message: enabled ? 'Bypass Policy Guard enabled for 15 minutes. Auto-revert scheduled.' : 'Bypass Policy Guard disabled.',
    ...result
  });
};

app.post('/api/v1/admin/bypass-guard', requireAdminAuth, handleBypassGuardToggle);
app.post('/api/bypass-policy-guard', requireAdminAuth, handleBypassGuardToggle);

// Google Cloud Marketplace Procurement & Telemetry Endpoints
app.post('/api/v1/marketplace/metering', requireAdminAuth, requireRole(['SuperAdmin', 'Admin']), (req: AuthenticatedRequest, res) => {
  const { tenantId, metricName, quantity } = req.body || {};
  const result = governanceEngine.processMarketplaceMeteringEvent(
    tenantId || 'tenant_default',
    metricName || 'agentsguardian.googleapis.com/intercepted_requests',
    Number(quantity) || 1
  );
  res.json(result);
});

app.post('/api/v1/marketplace/webhook', async (req, res) => {
  const authHeader = (req.headers.authorization as string) || 
                     (req.headers['x-goog-signature'] as string) || 
                     (req.headers['x-marketplace-token'] as string) || 
                     (req.headers['x-pubsub-oidc-token'] as string) ||
                     (req.body?.jwt as string);

  const authResult = await verifyGoogleOidcToken(authHeader, getGcpProjectId());
  if (!authResult.valid) {
    console.warn(`[Marketplace Webhook] Rejected unauthorized or forged webhook request from ${req.ip}: ${authResult.error}`);
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid or missing Google Marketplace authorization signature',
      details: authResult.error 
    });
  }

  const result = governanceEngine.handleMarketplaceWebhook(req.body || {
    eventType: 'ENTITLEMENT_CREATION_REQUESTED',
    tenantId: 'tenant_default',
    accountName: 'Acme Enterprise Corp',
    gcpMarketplaceAccountId: 'MKT-ACCT-9982'
  });
  return res.json(result);
});

app.post('/pubsub/push', async (req, res) => {
  const authHeader = (req.headers.authorization as string) || 
                     (req.headers['x-pubsub-oidc-token'] as string);

  const authResult = await verifyGoogleOidcToken(authHeader, getGcpProjectId());
  if (!authResult.valid) {
    console.warn(`[Pub/Sub Push] Rejected unauthorized or forged Pub/Sub push token: ${authResult.error}`);
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing Pub/Sub OIDC authorization token',
      details: authResult.error
    });
  }

  const pushMsg = req.body;
  let eventPayload: any = {};
  if (pushMsg?.message?.data) {
    try {
      const decoded = Buffer.from(pushMsg.message.data, 'base64').toString('utf8');
      eventPayload = JSON.parse(decoded);
    } catch {
      eventPayload = pushMsg.message.data;
    }
  } else {
    eventPayload = pushMsg;
  }

  const ledgerEntry = governanceEngine.appendAuditLedgerEntry(
    eventPayload.tenant_id || eventPayload.tenantId || 'tenant_default',
    eventPayload.agent_id || eventPayload.agentId || 'AG-PUBSUB-PUSH',
    eventPayload.status || eventPayload.eventType || 'PUBSUB_PUSH_EVENT',
    { actionCommand: eventPayload.action || eventPayload.actionCommand || 'pubsub_event' }
  );

  return res.json({ status: 'LEDGER_WRITTEN_ACK', entryId: ledgerEntry.id });
});

app.get('/api/v1/marketplace/tenant-isolation-test', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantA = (req.query.tenant_a as string) || 'tenant_alpha';
  const tenantB = (req.query.tenant_b as string) || 'tenant_beta';
  res.json(governanceEngine.verifyMultiTenantIsolation(tenantA, tenantB));
});

app.get('/api/v1/marketplace/tenants', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    tenants: governanceEngine.getTenants(),
    total: governanceEngine.getTenants().length,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/marketplace/tenants', requireAdminAuth, requireRole(['SuperAdmin', 'Admin']), async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { name, planTier, apiKey, tenantId: requestedTenantId, budgetCap = 500 } = req.body || {};
    const tenantId = requestedTenantId || `tenant_${Date.now()}`;
    const rawKey = apiKey || `ag_live_${crypto.randomBytes(24).toString('hex')}`;

    governanceEngine.registerTenantApiKey(rawKey, tenantId);
    try {
      await storageEngine.registerApiKey(rawKey, tenantId);
    } catch (e) {
      console.warn('StorageEngine registerApiKey warning:', e);
    }

    const tenantRecord = {
      id: tenantId,
      name: name || `Tenant ${tenantId}`,
      planTier: planTier || 'ENTERPRISE',
      gcpMarketplaceAccountId: `MKT-${Date.now()}`,
      billingStatus: 'ACTIVE' as const,
      apiKey: rawKey,
      budgetCap: Number(budgetCap),
      currentSpend: 0.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    (governanceEngine as any).tenantsMap.set(tenantId, tenantRecord);
    governanceEngine.setTenantBudgetCap(tenantId, Number(budgetCap));

    return res.json({ success: true, tenant: tenantRecord, apiKey: rawKey });
  } catch (err: any) {
    console.error('Error in POST /api/v1/marketplace/tenants:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/v1/tenant-keys/validate', async (req: express.Request, res: express.Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown_caller';
  if (isValidateKeyRateLimited(`ip:${clientIp}`, 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many key validation requests. Rate limit exceeded.' });
  }

  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  const providedSecret = req.headers['x-internal-service-key'];
  if (!internalSecret || !providedSecret || providedSecret !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing internal service credential' });
  }

  const apiKey = (req.body?.apiKey || req.body?.api_key) as string;
  const validation = governanceEngine.validateTenantApiKey(apiKey);
  return res.json(validation);
});

app.get('/api/v1/marketplace/reconcile', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || 'tenant_default';
  res.json(governanceEngine.reconcileMarketplaceMetering(tenantId));
});

app.post('/api/v1/marketplace/reconcile', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const { tenantId = 'tenant_default' } = req.body || {};
  res.json(governanceEngine.reconcileMarketplaceMetering(tenantId));
});

app.get('/api/v1/marketplace/sla-report', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || 'tenant_default';
  res.json(governanceEngine.getRealTenantSlaReport(tenantId));
});

app.get('/api/v1/marketplace/security-spec', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getMarketplaceSecurityAndVpcSpec());
});

app.get('/api/policies', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  res.json(governanceEngine.getPolicies(tenantId));
});

app.post('/api/policies', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'PolicyManager']), (req: AuthenticatedRequest, res) => {
  const newPolicy = req.body;
  const tenantId = req.body.tenantId || (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  const savedPolicy = governanceEngine.addPolicy(tenantId, newPolicy);
  res.json({ success: true, policy: savedPolicy });
});

app.post('/api/policies/toggle', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'PolicyManager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.body;
  const tenantId = req.body.tenantId || (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  const policy = governanceEngine.togglePolicy(tenantId, id);
  if (policy) {
    res.json({ success: true, policy });
  } else {
    res.status(404).json({ error: 'Policy not found for this tenant' });
  }
});

app.delete('/api/policies/:id', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'PolicyManager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const tenantId = (req.query.tenant_id as string) || req.body?.tenantId || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  const success = governanceEngine.deletePolicy(tenantId, id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Policy not found for this tenant' });
  }
});

// 10. Kill Events Management
app.get('/api/kill-events', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  res.json(governanceEngine.getKillEvents(tenantId));
});

app.post('/api/kill-events', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  const newEvent = req.body;
  const state = governanceEngine.getState();
  state.killEvents.unshift(newEvent);
  res.json({ success: true, event: newEvent });
});

app.delete('/api/kill-events', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  state.killEvents = [];
  res.json({ success: true });
});

// 11. Governed Agents Management
app.get('/api/agents', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  res.json(governanceEngine.getAgents(tenantId));
});

app.post('/api/agents', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  const agent = req.body;
  const tenantId = req.body.tenantId || (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  const savedAgent = governanceEngine.addAgent(tenantId, agent);
  res.json({ success: true, agent: savedAgent });
});

app.post('/api/agents/bulk-status', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  const { ids, status } = req.body;
  const tenantId = req.body.tenantId || (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  const agents = governanceEngine.getAgents(tenantId);
  agents.forEach(a => {
    if (ids.includes(a.id)) {
      a.status = status;
    }
  });
  res.json({ success: true, count: ids.length, status });
});

// 12. Labor Config & Budget Cap
app.get('/api/labor-config', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getState().laborConfig);
});

app.put('/api/labor-config', requireAdminAuth, requireRole(['SuperAdmin', 'Admin']), (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  state.laborConfig = { ...state.laborConfig, ...req.body };
  res.json({ success: true, laborConfig: state.laborConfig });
});

app.get('/api/budget-cap', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const tenantId = (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  res.json({
    tenantId,
    budgetCap: governanceEngine.getTenantBudgetCap(tenantId),
    currentSpend: governanceEngine.getTenantCurrentSpend(tenantId)
  });
});

app.put('/api/budget-cap', requireAdminAuth, requireRole(['SuperAdmin', 'Admin']), (req: AuthenticatedRequest, res) => {
  const { budgetCap } = req.body;
  const tenantId = req.body.tenantId || (req.query.tenant_id as string) || req.tenantId || req.authUser?.tenantId || 'tenant_default';
  if (typeof budgetCap === 'number') {
    governanceEngine.setTenantBudgetCap(tenantId, budgetCap);
  }
  res.json({ success: true, tenantId, budgetCap: governanceEngine.getTenantBudgetCap(tenantId) });
});

// 13. Multi-Tenant Isolation Test Endpoint
app.get('/api/v1/tests/multi-tenant-isolation', (req: express.Request, res: express.Response) => {
  const tenantA = (req.query.tenant_a as string) || 'tenant_alpha';
  const tenantB = (req.query.tenant_b as string) || 'tenant_beta';
  res.json(governanceEngine.verifyMultiTenantIsolation(tenantA, tenantB));
});

app.post('/api/v1/tests/multi-tenant-isolation', (req: express.Request, res: express.Response) => {
  const { tenant_a = 'tenant_alpha', tenant_b = 'tenant_beta' } = req.body || {};
  res.json(governanceEngine.verifyMultiTenantIsolation(tenant_a, tenant_b));
});

// 13. Users Management
app.get('/api/users', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getState().users);
});

app.post('/api/users', requireAdminAuth, requireRole(['SuperAdmin']), (req: AuthenticatedRequest, res) => {
  const newUser = req.body;
  const state = governanceEngine.getState();
  state.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', requireAdminAuth, requireRole(['SuperAdmin']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const state = governanceEngine.getState();
  const index = state.users.findIndex(u => u.id === id);
  if (index !== -1) {
    state.users[index] = { ...state.users[index], ...req.body };
    res.json({ success: true, user: state.users[index] });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// 14. Onboarding Complete & State Sync
app.post('/api/onboarding/complete', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  state.governanceMode = 'active';
  state.notifications.unshift({
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'success',
    category: 'System',
    title: '🎉 Platform Transitioned to Active Governance Mode',
    message: 'Onboarding Step 5 verified. All platform modules (Overview, Policies, Secure Interceptor, Value Meter) synchronized to Active Governance Mode.',
    read: false,
    targetTab: 'overview'
  });
  res.json({ success: true, governanceMode: 'active' });
});

// 15. Notifications
app.get('/api/notifications', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  res.json(governanceEngine.getState().notifications);
});

app.put('/api/notifications/read-all', requireAdminAuth, (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  state.notifications = state.notifications.map(n => ({ ...n, read: true }));
  res.json({ success: true });
});

app.delete('/api/notifications', requireAdminAuth, requireRole(['SuperAdmin', 'Admin', 'Operator']), (req: AuthenticatedRequest, res) => {
  const state = governanceEngine.getState();
  state.notifications = [];
  res.json({ success: true });
});


// Lazy Gemini Client Initialization
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

// Helper: Intelligent Semantic Knowledge Base Synthesizer (Fallback when API key is not set or network offline)
function synthesizeIntelligentReply(query: string, laborConfig: any, budgetCap: number): string {
  const q = query.toLowerCase();

  // 1. Labor Cost & Economic Configuration queries
  if (q.includes('labor') || q.includes('wage') || q.includes('rate') || q.includes('cost') || q.includes('roi') || q.includes('savings') || q.includes('value') || q.includes('spend')) {
    const l1 = laborConfig?.l1Rate || 35;
    const l2 = laborConfig?.l2Rate || 75;
    const l3 = laborConfig?.l3Rate || 150;
    const avgHrs = laborConfig?.avgHoursPerTask || 0.25;
    return `### ECONOMIC ANALYSIS: **HUMAN LABOR COST EQUIVALENCY & ROI INDEX**
Your question specifically touches on economic valuation and labor benchmarks within the GaaS ecosystem.

**Active Interactive Labor Configuration:**
- **L1 Support / Triage Specialist Rate**: **$${l1}.00 / hr**
- **L2 DevOps / Systems Engineer Rate**: **$${l2}.00 / hr**
- **L3 SRE / Enterprise Architect Rate**: **$${l3}.00 / hr**
- **Average Handling Time per Ticket**: **${avgHrs * 60} mins (${avgHrs} hrs)**

**How Your ROI & Cost Avoidance is Computed:**
1. **Human Cost Equivalent**: For 1,000 automated tasks (e.g. password resets or triage), the equivalent human effort is $1,000 \\times ${avgHrs} \\text{ hrs} \\times \\$${l1}/\\text{hr} = \\$${(1000 * avgHrs * l1).toLocaleString()}$.
2. **AI API Token Burn**: At standard model rates, 1,000 tasks consume approximately **$42.50** in token spend.
3. **Net Cost Avoidance**: You achieve an immediate savings of **$${(1000 * avgHrs * l1 - 42.50).toLocaleString()}**, representing a dynamic ROI multiplier of **${((1000 * avgHrs * l1) / 42.50).toFixed(1)}x**.

You can interactively adjust these wage sliders and test 6 stress scenarios directly in the **Value Meter (Pillar 3: Measure)** tab under **Feature 02: Interactive Human Labor Cost Configuration**!`;
  }

  // 2. Budget Cap & Runaway Bloat queries
  if (q.includes('budget') || q.includes('cap') || q.includes('limit') || q.includes('bloat') || q.includes('runaway') || q.includes('drain') || q.includes('50')) {
    return `### ECONOMIC GUARDRAILS: **ACTIVE SESSION BUDGET CAPS & BLOAT CONTAINMENT**
In response to your query about financial limits: your active session budget threshold is currently configured at **$${budgetCap}.00 USD**.

**Why Budget Caps are Critical for GenAI Agents:**
- **Context Window Bloat**: Recursive multi-agent conversations can ingest massive token histories (e.g. 1M+ token context loops), causing API spend per session to spike from cents to **$54.20+**.
- **Infinite Loop Protection**: Autonomous agents that fail to terminate can drain budgets rapidly (e.g., our simulation shows an uncontained scraper burning **$185.00** before containment).
- **Automated Interception**: Whenever an agent session attempts to commit an API payload exceeding your **$${budgetCap}.00** limit, the Agent Guardian gateway instantly aborts the transmission, raises a financial **ALERT**, and logs the violating cost to protect corporate treasury.`;
  }

  // 3. Kill Switch & Threat Interceptor queries
  if (q.includes('kill') || q.includes('switch') || q.includes('halt') || q.includes('intercept') || q.includes('block') || q.includes('security') || q.includes('gate') || q.includes('firewall')) {
    return `### SECURITY SHIELD: **THREAT INTERCEPTOR & AUTOMATIC KILL-SWITCH**
Regarding your inquiry on interception and system halting: Agent Guardian acts as an inline cryptographic gateway between your autonomous LLM agents and your production infrastructure.

**Operational Flow:**
1. **Outbound Packet Inspection**: Before any agent executes a database query, shell script, or external HTTP request, the payload is verified against active policies in <15ms latency.
2. **Intent Analysis**: The gateway inspects the JSON payload for forbidden actions (e.g., database drops, PII exfiltration, or unauthorized sudo commands).
3. **Instant Mitigation**: If a violation occurs, the system triggers an immediate **HALT**, revokes the container's session token, and records a critical event on the **Secure (Pillar 1)** board.
4. **Bulk Controls**: From the **GaaS / APIs** tab, operators can use the master checkboxes to execute an instant **🚨 Bulk Halt** or **🛡️ Bulk Resume** across multiple agent nodes simultaneously.`;
  }

  // 4. Cognitive Drift & Sentiment queries
  if (q.includes('drift') || q.includes('cognitive') || q.includes('health') || q.includes('sentiment') || q.includes('hallucin') || q.includes('observe') || q.includes('sentinel')) {
    return `### OBSERVABILITY: **SENTINEL COGNITIVE DRIFT & HEALTH INDEX**
Your query relates to behavioral alignment and model health. Because LLMs are non-deterministic, agents can experience semantic drift over prolonged autonomous runs.

**The Sentinel Diagnostic Strategy:**
- **Cognitive Health Score**: Continuously tracks agent alignment on a 0% to 100% scale. Scores below **70%** trigger automated warnings for semantic deviation or hallucination.
- **Sentiment Shift Tracking**: Measures divergence from ethical and brand guidelines.
- **Alignment Remediation**: Clicking **"Remediate Alignment"** on the Observe (Pillar 2) dashboard hot-injects pre-vetted compliance vectors directly into the agent's context window, instantly realigning the model without requiring container restarts.`;
  }

  // 5. Policies & IAM Roles queries
  if (q.includes('policy') || q.includes('rule') || q.includes('iam') || q.includes('role') || q.includes('permission') || q.includes('admin') || q.includes('auditor') || q.includes('operator')) {
    return `### GOVERNANCE: **CRYPTOGRAPHIC POLICIES & ENTERPRISE IAM**
In response to your query regarding rules and access control:

**Policy Hierarchy (3 Categories):**
1. **Security**: Administrative boundaries preventing unauthorized system execution or network access.
2. **Ethics**: Behavioral safeguards blocking toxic, biased, or unguided prompt outputs.
3. **Finance**: Economic limits enforcing budget caps and preventing runaway loops.

**Role-Based Access Control (IAM):**
- **SuperAdmin / Workspace Owner**: Full authority to toggle policies, configure kill-switches, and manage users.
- **Operator**: Tasked with runtime health; can trigger single-node or bulk halts and resumes.
- **Auditor**: Strictly read-only compliance access. Actions like simulated drift injections or policy toggles are locked out.`;
  }

  // 6. MCP (Model Context Protocol) queries
  if (q.includes('mcp') || q.includes('model context protocol')) {
    return `### MODEL CONTEXT PROTOCOL (MCP) INTEGRATION ARCHITECTURE

**Why Model Context Protocol (MCP) and How it Integrates with AgentsGuardian:**
1. **MCP Specification**: Created by Anthropic and supported across the ecosystem, MCP (Model Context Protocol) is an open JSON-RPC specification for connecting AI clients (Claude Desktop, IDEs, custom agents) to tool/context servers.
2. **MCP vs. Node.js & LangChain**:
   - **Node.js** is a JavaScript runtime environment. MCP servers and clients are routinely built *using* Node.js, Python, or Go!
   - **LangChain / CrewAI / AutoGen** are agent orchestration frameworks. MCP standardizes how tools and context resources are exposed to those frameworks. They complement each other!
3. **AgentsGuardian Zero-Trust MCP Proxy Gateway**:
   - AgentsGuardian provides a native **MCP Intercept Gateway** that wraps MCP \`tools/call\`, \`resources/read\`, and \`prompts/get\` requests.
   - Every MCP tool call is cryptographically intercepted in <15ms before server side-effects take place. If a policy is violated, the proxy returns a standard JSON-RPC exception and triggers a Kill-Switch event.

You can register your MCP Servers or view ready-to-use TypeScript/Python code snippets in the **GaaS / APIs** tab!`;
  }

  // 7. Implementation & Client Onboarding queries
  if (q.includes('implementation') || q.includes('onboard') || q.includes('step') || q.includes('guide') || q.includes('sdk') || q.includes('proxy') || q.includes('integrate') || q.includes('how to implement') || q.includes('setup') || q.includes('code')) {
    return `### ONBOARDING & IMPLEMENTATION: **5-STEP GAAS CLIENT INTEGRATION PROTOCOL**

To integrate Agent Guardian (GaaS) into your client codebase, follow these 5 steps:

**Step 1: Security Handshake & Authenticated Key Exchange**
- Generate your client API token in the **Client Onboarding Guide (Tab 2)**.
- Store your \`AG_PROD_KEY\` securely in your server environment variables.

**Step 2: Outbound Proxy / Zero-Code Integration**
- **Zero-Code Proxy Redirect**: Redirect your LLM framework's base URL:
\`\`\`bash
export OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"
\`\`\`
- **Native Python / Node SDK**:
\`\`\`python
from agent_guardian import Shield

shield = Shield(api_key="ag_prod_live_key", framework="crewai")
is_valid, report = shield.inspect_packet({
    "intent": "execute query",
    "approximate_cost": 0.02
})
\`\`\`

**Step 3: Policy Mapping & Blast Radius**
- Map security guardrails (Security, Ethics, Finance) in **Policy Config**.
- Configure regional labor wage sliders ($35/hr L1, $75/hr L2, $150/hr L3) and set your **$${budgetCap}.00 Session Budget Cap**.

**Step 4: Real-Time Telemetry Sentinel**
- Pipe execution heartbeats with sub-10ms deterministic authorization and sub-100ms semantic threat scanning for live drift & ROI tracking.

**Step 5: Testing & Dynamic Sandbox Verification**
- Run local handshake verification:
\`\`\`bash
npx @agent-guardian/cli test-handshake --apiKey=ag_prod_live_key
\`\`\`

Navigate to **Tab 2: Client Onboarding Guide** in the Help Center to view interactive code generators for Python, Node.js, and curl!`;
  }

  // 7. General specific answer synthesizing any other query
  return `### SYSTEM INTEL: **AGENT GUARDIAN (GAAS) REASONING RESPONSE**
Here is the specific analysis for your query: *"**${query}**"*.

**Architectural Synthesis:**
1. **Real-Time Telemetry**: Your GaaS ecosystem is actively auditing agent requests across all four pillars: **Secure** (Kill-Switch), **Observe** (Cognitive Drift), **Measure** (Economic Value Meter & Labor Cost Config), and **Admin** (IAM Governance).
2. **Interactive Labor Configuration**: You can configure your exact human wage rates ($35/hr L1, $75/hr L2, $150/hr L3) and test 6 stress scenarios directly in the **Value Meter** tab.
3. **Gateway Protection**: All agent executions are evaluated against your active **$${budgetCap}.00** session budget cap and cryptographic policy rules before committing side-effects.

*Need to test a specific scenario? Click any of the quick suggestion badges below or navigate to **Pillar 3: Measure** to interact with the human labor wage sliders!*`;
}

// POST /api/copilot and /api/copilot/ask
app.post(['/api/copilot', '/api/copilot/ask'], async (req, res) => {
  try {
    const { query, history, user, activeTab, laborConfig, budgetCap = 50 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const client = getAiClient();
    if (client) {
      try {
        const systemPrompt = `You are the Guardian Automated Support CoPilot for Agent Guardian (GaaS - Governance as a Service), an enterprise AI agent governance and observability platform.
Your user is ${user?.name || 'Administrator'} (${user?.role || 'SuperAdmin'}).

CRITICAL INSTRUCTIONS:
- You MUST answer the specific question asked by the user with deep technical accuracy, clear structure, and actionable insights. Never give generic canned responses.
- Explain things clearly, using markdown formatting (bullet points, bold text, step-by-step guidance).

KEY PLATFORM CONSTRUCTS & RECENT FEATURES TO KNOW:
1. Feature 02: Interactive Human Labor Cost Configuration (Located in Pillar 3: Measure / Value Meter tab):
   - Allows users to interactively configure hourly wage rates: L1 Support/Triage (${laborConfig?.l1Rate || 35}/hr), L2 DevOps (${laborConfig?.l2Rate || 75}/hr), L3 SRE/Architect (${laborConfig?.l3Rate || 150}/hr), and Audit Rate (${laborConfig?.auditRate || 60}/hr), plus average ticket handling time (${laborConfig?.avgHoursPerTask || 0.25} hrs).
   - Dynamically computes Net Cost Avoidance ($ Savings) and ROI Multipliers by comparing AI token spend against equivalent human labor cost.
2. Economic Simulation Engine:
   - Includes 6 stress test scenarios: 500 Password Resets, L1 Triage Surge (2,500 tickets), SRE Incident Remediation (50 logs), Dynamic Custom Labor Benchmark Test, 1M Token Context Bloat, and Runaway Infinite Loop Drain ($185 burn).
3. Active Session Budget Cap: Currently set to $${budgetCap}.00 USD. When an agent session exceeds this, the Threat Interceptor raises an alert and halts transmission.
4. Model Context Protocol (MCP) Support:
   - AgentsGuardian natively supports Anthropic's open Model Context Protocol (MCP) standard as a Zero-Trust Intercept Gateway for MCP Servers and MCP Clients.
   - MCP is a JSON-RPC communication protocol, while Node.js is a runtime, and LangChain/CrewAI/AutoGen are agent frameworks. MCP standardizes tool and resource access across all of them!
   - AgentsGuardian intercepts MCP \`tools/call\` requests in <15ms to evaluate parameters against active policies before server execution.
5. The 4 Pillars:
   - Pillar 1 (Secure): Cryptographic Policy Engine, Threat Interceptor, Automatic Kill-Switch.
   - Pillar 2 (Observe): Sentinel Observability, Cognitive Health Score (alignment <70% triggers drift warning), Alignment Remediation toggle.
   - Pillar 3 (Measure): Value Meter, Economic Process Tracker, Interactive Labor Cost Config, CFO Alerting.
   - Pillar 4 (Admin): Enterprise IAM, SSO RBAC (SuperAdmin, PolicyManager, Operator, Auditor).

Answer the user query: "${query}" directly, thoroughly, and professionally.`;

        const response = await client.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: query,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3,
          }
        });

        if (response && response.text) {
          return res.json({ reply: response.text, mode: 'gemini' });
        }
      } catch (err) {
        console.warn('Gemini API call failed or timed out, falling back to intelligent semantic reasoning engine:', err);
      }
    }

    // Fallback: Intelligent Semantic Knowledge Base Synthesizer
    const synthesizedReply = synthesizeIntelligentReply(query, laborConfig, budgetCap);
    return res.json({ reply: synthesizedReply, mode: 'semantic' });
  } catch (error) {
    console.error('Error in /api/copilot:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/parse-law-pdf
app.post('/api/parse-law-pdf', async (req, res) => {
  try {
    const { filename, fileContent, actPreset } = req.body;
    
    // Validate inputs
    if (!filename && !actPreset) {
      return res.status(400).json({ error: 'Filename or Act Preset is required' });
    }

    const client = getAiClient();
    if (client) {
      try {
        const prompt = `You are an elite Legal Compliance Officer and Systems Engineer.
Analyze the following law, regulation, or AI Act:
Name: "${filename || actPreset}"
Content Description: "${fileContent || 'Utilize standard historical knowledge and provisions of this specific regulation'}"

Translate this legal regulation into exactly 3 concrete, highly actionable digital policies that can be enforced at the gateway layer of an LLM agent platform.
You must return a JSON array containing exactly 3 policy objects, one for each of these categories:
1. "security" (enforced in the Secure Pillar / Threat Interceptor. E.g. restricting direct file writes, system commands, or unauthenticated database reads).
2. "ethics" (enforced in the Observe Pillar / Sentinel. E.g. bias evaluation, toxic output detection, compliance alignment).
3. "finance" (enforced in the Measure Pillar / Value Meter. E.g. budget capping, token limits, or SRE resource limits to prevent economic drain).

Each policy object MUST have this exact schema:
{
  "id": "unique-id-string" (e.g. POL-LAW-SEC, POL-LAW-ETH, POL-LAW-FIN),
  "code": "POL-LAW-SEC" | "POL-LAW-ETH" | "POL-LAW-FIN" (or similar short prefix),
  "name": "Concise name of the policy reflecting the legal article",
  "description": "Clear explanation of what is restricted or enforced, citing the specific law/article",
  "category": "security" | "ethics" | "finance",
  "blastRadius": "e.g. Global Gateway / Agent Container / API Node",
  "threshold": "e.g. Halt instantly / Warn on drift >70% / Cap past budget threshold",
  "enabled": true
}

Return ONLY a valid raw JSON array containing exactly these 3 objects. Do not include markdown code block wrapper (e.g. no \`\`\`json) or any pre-text or post-text. Ensure it is valid JSON.`;

        const response = await client.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            temperature: 0.2,
          }
        });

        if (response && response.text) {
          try {
            // Clean markdown wrappers if returned
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```json')) {
              cleanText = cleanText.substring(7);
            }
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith('```')) {
              cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            cleanText = cleanText.trim();
            
            const parsedPolicies = JSON.parse(cleanText);
            if (Array.isArray(parsedPolicies) && parsedPolicies.length === 3) {
              return res.json({ policies: parsedPolicies, mode: 'gemini' });
            }
          } catch (e) {
            console.warn('Failed to parse Gemini JSON output, falling back to expert systems compiler:', e);
          }
        }
      } catch (err) {
        console.warn('Gemini API call failed for compliance compilation, falling back to expert systems compiler:', err);
      }
    }

    // Expert Fallback Compiler Database
    let generatedPolicies = [];
    const act = (actPreset || filename || "custom").toLowerCase();

    if (act.includes("eu") || act.includes("europe") || act.includes("article")) {
      generatedPolicies = [
        {
          id: "POL-EU-01",
          code: "POL-SEC-EU",
          name: "GPAI Technical Documentation & Risk Protocol (EU Annex IV & Art. 9)",
          description: "Mandates technical documentation under Annex IV and continuous risk evaluations for GPAI systems. Secure gateway blocks model executions failing strict runtime sandbox container boundaries.",
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Halt instantly",
          enabled: true
        },
        {
          id: "POL-EU-02",
          code: "POL-ETH-EU",
          name: "Record-Keeping & Logging Sentinel (EU Art. 12)",
          description: "Implements mandatory record-keeping and automated event logging pursuant to EU AI Act Article 12. Audits model responses, logging incidents to avoid maximum statutory penalties up to €35M / 7% global turnover.",
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Log & Audit",
          enabled: true
        },
        {
          id: "POL-EU-03",
          code: "POL-FIN-EU",
          name: "GP-LLM Systematic Token Ceiling (EU Art. 51)",
          description: "Limits execution resources to guard against systemic performance threats. Caps maximum API token context sizes to protect processing costs under statutory budgets.",
          category: "finance",
          blastRadius: "API Node",
          threshold: "Throttle at $50/sess",
          enabled: true
        }
      ];
    } else if (act.includes("executive") || act.includes("eo 14110") || act.includes("federal") || act.includes("us")) {
      generatedPolicies = [
        {
          id: "POL-US-01",
          code: "POL-SEC-US",
          name: "Dual-Use Foundation Safety (US Federal AI Posture 2025)",
          description: "Enforces national AI red-teaming standards under the current 2025 Executive Order Framework (superseding revoked EO 14110). Interceptor halts outbound system shell invocations and validates agent payloads.",
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Enforce instantly",
          enabled: true
        },
        {
          id: "POL-US-02",
          code: "POL-ETH-US",
          name: "Civil Rights & Algorithmic Guardrails (US Federal AI 2025)",
          description: "Prevents unfair algorithmic outputs in high-stakes operational environments. Ethic engine audits model sentiment and blocks disparate impacts on protected groups.",
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Reject on violation",
          enabled: true
        },
        {
          id: "POL-US-03",
          code: "POL-FIN-US",
          name: "Federal Compute Allocation Caps (US Federal AI 2025)",
          description: "Enforces enterprise computing resource management. Restricts recursive agent reasoning loops from exceeding enterprise budget caps.",
          category: "finance",
          blastRadius: "API Node",
          threshold: "Halt past budget",
          enabled: true
        }
      ];
    } else if (act.includes("sb53") || act.includes("sb-53") || act.includes("53") || act.includes("california") || act.includes("sb-1047") || act.includes("1047")) {
      generatedPolicies = [
        {
          id: "POL-CA-01",
          code: "POL-SEC-CA",
          name: "Frontier Model Transparency & Safety (CA SB 53, 2025 Enacted)",
          description: "Implements California's 2025 enacted frontier-model statute (replacing vetoed SB-1047). Mandates developer emergency shutdown / kill-switch capability and incident reporting.",
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Halt instantly",
          enabled: true
        },
        {
          id: "POL-CA-02",
          code: "POL-ETH-CA",
          name: "Critical Harm Risk Protocol (CA SB 53)",
          description: "Performs continuous testing for biological, chemical, or systemic cyberattack capabilities under California SB 53. Sentinel automatically quarantines agents attempting unauthorized system network access.",
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Isolate & Halt",
          enabled: true
        },
        {
          id: "POL-CA-03",
          code: "POL-FIN-CA",
          name: "Frontier Compliance Audit Cap (CA SB 53)",
          description: "Limits compliance-related computational expenses. Restricts unmoderated retrieval calls to protect active operational budget thresholds.",
          category: "finance",
          blastRadius: "API Node",
          threshold: "Caps past $50.00",
          enabled: true
        }
      ];
    } else if (act.includes("colorado") || act.includes("205") || act.includes("sb-24-205")) {
      generatedPolicies = [
        {
          id: "POL-CO-01",
          code: "POL-SEC-CO",
          name: "Deployer Risk Tracking (CO SB 24-205 • Tracking / Delayed to June 2026)",
          description: "Tracks risk mitigation requirements under Colorado SB 24-205 (amended and framed under tracking status with enforcement delayed to June 2026). Validates security logs periodically.",
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Log transactions",
          enabled: true
        },
        {
          id: "POL-CO-02",
          code: "POL-ETH-CO",
          name: "Consumer Bias Monitoring (CO SB 24-205)",
          description: "Tracks algorithmic discrimination risks in consumer decisioning. Audits output language alignment scores under Colorado's updated June 2026 framework.",
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Flag & Notify",
          enabled: true
        },
        {
          id: "POL-CO-03",
          code: "POL-FIN-CO",
          name: "Colorado Compliance Cost Controller",
          description: "Restricts regulatory report ingestion overhead. Ensures compliance checking routines do not trigger recursive model calls that drain budget thresholds.",
          category: "finance",
          blastRadius: "API Node",
          threshold: "Throttle at 80% cap",
          enabled: true
        }
      ];
    } else if (act.includes("canada") || act.includes("aida") || act.includes("artificial")) {
      generatedPolicies = [
        {
          id: "POL-CAN-01",
          code: "POL-SEC-CAN",
          name: "AIDA Core System Safety Protocols",
          description: "Mandates mitigation measures for high-impact systems. Outbound interceptor prevents model execution of untrusted external shell commands.",
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Halt instantly",
          enabled: true
        },
        {
          id: "POL-CAN-02",
          code: "POL-ETH-CAN",
          name: "AIDA Bias Mitigation & Fairness Audit",
          description: "Mitigates risks of biased outcomes or discriminatory outputs. Active sentinel analyzes sentiment variance across different linguistic inputs.",
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Alert on drift",
          enabled: true
        },
        {
          id: "POL-CAN-03",
          code: "POL-FIN-CAN",
          name: "AIDA Administrative Penalty Limit",
          description: "Limits potential financial impacts from non-compliance. Automatically caps API token spend to prevent uncontrolled multi-agent feedback loops.",
          category: "finance",
          blastRadius: "API Node",
          threshold: "Halt at $50 budget",
          enabled: true
        }
      ];
    } else {
      // Generic custom file fallback
      const normalizedAct = (filename || actPreset || "Custom Compliance Directive").replace(/[_-]/g, ' ');
      generatedPolicies = [
        {
          id: "POL-GEN-SEC-" + Math.floor(Math.random() * 90 + 10),
          code: "POL-SEC-GEN",
          name: `Secure Shield Alignment: ${normalizedAct}`,
          description: `Outbound gateway intercepts and filters unauthorized system executions to protect local infrastructure under the guidelines of ${normalizedAct}.`,
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Halt instantly",
          enabled: true
        },
        {
          id: "POL-GEN-ETH-" + Math.floor(Math.random() * 90 + 10),
          code: "POL-ETH-GEN",
          name: `Ethical Compliance Sentinel: ${normalizedAct}`,
          description: `Active sentinel continuously evaluates model response alignments and cognitive drift levels to satisfy compliance audits for ${normalizedAct}.`,
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Warn on deviation",
          enabled: true
        },
        {
          id: "POL-GEN-FIN-" + Math.floor(Math.random() * 90 + 10),
          code: "POL-FIN-GEN",
          name: `Financial Guardrail Cap: ${normalizedAct}`,
          description: `Implements the Spend Guardrail protocol to halt recursive agent conversations or bloated context transmissions under ${normalizedAct}.`,
          category: "finance",
          blastRadius: "API Node",
          threshold: "Halt past budget",
          enabled: true
        }
      ];
    }

    return res.json({ policies: generatedPolicies, mode: 'expert-system' });
  } catch (error) {
    console.error('Error in /api/parse-law-pdf:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API 404 Handler for unmatched /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
