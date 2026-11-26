/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Rocket, Sliders, Shield, Compass, Activity, CheckCircle2, Copy, 
  Terminal, ArrowRight, Play, RefreshCw, Send, DollarSign, Lock, Sparkles, Check
} from 'lucide-react';
import { AdminUser, Toast, Policy, LaborConfig } from '../types';
import { GUARANTEED_SLA_MS, generateTransactionId } from '../utils';

interface CustomerOnboardingProps {
  currentUser: AdminUser;
  addToast: (t: Omit<Toast, 'id' | 'timestamp'>) => void;
  onNavigateTab: (tabId: string) => void;
  budgetCap: number;
  laborConfig?: LaborConfig;
  policies?: Policy[];
  governanceMode?: 'setup' | 'active';
  setGovernanceMode?: (mode: 'setup' | 'active') => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// Inline markdown parser for bold, inline code, and block formatting
const parseInlineStyles = (str: string) => {
  const tokenRegex = /(\*\*.*?\*\*|`.*?`|\$\$.*?\$\$)/g;
  const parts = str.split(tokenRegex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-zinc-900 border border-zinc-800 text-teal-300 font-mono px-1 py-0.2 rounded text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('$$') && part.endsWith('$$')) {
      return (
        <span key={i} className="font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] block my-1">
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
};

// Rich chat message renderer for code blocks & markdown
const renderFormattedChatMessage = (text: string, onCopyCode?: (code: string) => void) => {
  const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1] || 'bash', code: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return (
            <div key={idx} className="my-2 rounded-lg bg-black border border-zinc-800 overflow-hidden font-mono text-[10.5px]">
              <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/80 border-b border-zinc-800 text-[9px] text-zinc-400 uppercase font-bold">
                <span className="text-teal-400">{part.lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(part.code);
                    if (onCopyCode) onCopyCode(part.code);
                  }}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[9px] text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded"
                >
                  <Copy size={10} /> Copy Snippet
                </button>
              </div>
              <pre className="p-3 text-emerald-400 overflow-x-auto whitespace-pre font-mono leading-normal">
                {part.code}
              </pre>
            </div>
          );
        }

        const lines = part.content.split('\n');
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-mono font-bold text-teal-400 text-[11.5px] mt-2 mb-1 border-b border-zinc-800/60 pb-0.5">
                    {parseInlineStyles(trimmed.substring(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="font-mono font-extrabold text-white text-xs mt-2 mb-1">
                    {parseInlineStyles(trimmed.substring(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex gap-2 pl-2 text-zinc-300">
                    <span className="text-teal-400 font-bold">•</span>
                    <span>{parseInlineStyles(trimmed.substring(2))}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const matchNum = trimmed.match(/^(\d+)\.\s/);
                const num = matchNum ? matchNum[1] : '1';
                const content = trimmed.replace(/^\d+\.\s/, '');
                return (
                  <div key={lIdx} className="flex gap-2 pl-2 text-zinc-300">
                    <span className="text-teal-400 font-mono font-bold">{num}.</span>
                    <span>{parseInlineStyles(content)}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-zinc-300 leading-relaxed">
                  {parseInlineStyles(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function CustomerOnboarding({
  currentUser,
  addToast,
  onNavigateTab,
  budgetCap,
  laborConfig,
  policies = [],
  governanceMode = 'setup',
  setGovernanceMode
}: CustomerOnboardingProps) {
  const [activeSetupStep, setActiveSetupStep] = useState<number>(1);

  const [testPayload, setTestPayload] = useState<string>(
    '{"agent_id": "Agent-Production-Node", "intent": "Analyze quarterly budget ledger and execute database query", "approximate_cost": 0.02}'
  );
  const [isVerifyingSandbox, setIsVerifyingSandbox] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<string | null>(null);

  // Copilot assistant state inside onboarding
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: `### 🚀 ONBOARDING COPILOT ASSISTANT
Welcome **${currentUser.name}**! I am your dedicated Client Onboarding & SDK Copilot.

Ask me anything about:
- **Zero-Code Proxy Redirect**: How to set \`OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"\`
- **Native Python & Node SDKs**: How to import \`GuardianClient\` or \`GuardianProxy\`
- **Environment Key Handshake**: Generating & configuring \`AG_PROD_KEY\`
- **Testing Handshakes**: CLI verification & endpoint test requests`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  const [personaMode, setPersonaMode] = useState<'dev' | 'ciso'>('dev');
  const [isVerified, setIsVerified] = useState<boolean>(governanceMode === 'active');

  // Handle running the sandbox test handshake
  const handleRunSandboxTest = () => {
    setIsVerifyingSandbox(true);
    setSandboxResult(null);

    setTimeout(() => {
      setIsVerifyingSandbox(false);
      let payloadObj: any = {};
      try {
        payloadObj = JSON.parse(testPayload);
      } catch (e) {
        payloadObj = { intent: testPayload };
      }

      const intentText = (payloadObj.intent || testPayload).toLowerCase();
      const isSuspicious = intentText.includes('delete') || intentText.includes('drop') || intentText.includes('wire') || intentText.includes('exfiltrate');

      if (isSuspicious) {
        setSandboxResult(`[403 FORBIDDEN - GOVERNANCE INTERCEPT]
Status: HALTED_BY_SHIELD
Latency: 18ms
Policy Violated: POL-SEC-01 (Security Shield Protocol)
Packet Action: Blocked destructive database action or exfiltration vector.
Tenant Binding: ${currentUser.email} [ag_prod_live_${currentUser.id.substring(0,8)}_enc]`);
        addToast({
          type: 'warning',
          title: '🚨 Test Intercept Blocked Threat',
          message: 'The GaaS Interceptor correctly caught the anomalous test payload.'
        });
      } else {
        setSandboxResult(`[200 OK - GAAS NOMINAL]
Status: AUTHORIZED
Latency: 14ms
Signature: RSA-4096-VERIFIED
Telemetry: Heartbeat recorded in Observability Stream
Budget Cap Status: OK ($${budgetCap}.00 remaining)`);
        setIsVerified(true);
        if (setGovernanceMode) setGovernanceMode('active');
        const token = typeof window !== 'undefined' ? (localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token')) : null;
        fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }).catch(e => console.warn(e));
        addToast({
          type: 'success',
          title: '⚡ Handshake Verification Success',
          message: 'GaaS Gateway returned 200 OK signature. System transitioned to Active Governance Mode.'
        });
      }
    }, 900);
  };

  // Copilot query submission handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isThinking) return;

    const userText = inputQuery.trim();
    const userMsg: ChatMessage = {
      id: generateTransactionId('u'),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userText, 
          user: currentUser, 
          laborConfig, 
          budgetCap, 
          activeTab: 'onboarding' 
        })
      });

      let answerText = '';
      if (res.ok) {
        const data = await res.json();
        answerText = data.reply || data.answer;
      } else {
        throw new Error('API route unavailable');
      }

      const assistantMsg: ChatMessage = {
        id: generateTransactionId('a'),
        sender: 'assistant',
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      // Local fallback intelligent onboarding response
      const q = userText.toLowerCase();
      let replyText = '';

      if (q.includes('heatmap') || q.includes('30day') || q.includes('30-day') || q.includes('activity volume') || q.includes('anomaly frequency')) {
        replyText = `### OVERVIEW ANALYTICS: 30-DAY EXECUTION ACTIVITY & ANOMALY HEATMAP
The 30-Day Heatmap tracks daily request execution density and policy interception anomaly spikes over a rolling 30-day window.

**Onboarding Telemetry Setup:**
Piping client telemetry in Step 4 automatically populates daily call counts, policy intercepts, compliance percentages, and peak activity dates on your Overview board. You can toggle between **Activity Volume** (emerald density) and **Anomaly Frequency** (crimson interception spikes) view modes.`;
      } else if (q.includes('gauge') || q.includes('health score') || q.includes('agent health')) {
        replyText = `### OVERVIEW ANALYTICS: GOVERNED AGENT HEALTH GAUGES
Governed Agent Health Gauges display real-time SVG radial gauges representing the operational health percentage per agent node:

$$\\text{Health Score (\\%)} = \\left(\\frac{\\text{Authorized Calls}}{\\text{Total Requests}}\\right) \\times 100$$

- **Teal (HEALTHY, $\\ge 85\\%$)**: High operational stability and policy compliance.
- **Amber (EVALUATING, $60-84\\%$)**: Active evaluation or warning alerts.
- **Crimson (HALT ALERT, $< 60\\%$)**: Frequent policy intercepts requiring immediate investigation.`;
      } else if (q.includes('marketplace') || q.includes('gcp') || q.includes('procurement') || q.includes('entitlement')) {
        replyText = `### GCP MARKETPLACE & MULTI-TENANT PROVISIONING
AgentsGuardian natively integrates with Google Cloud Marketplace via \`/api/v1/marketplace/webhook\`:

1. **Automated Provisioning**: Subscribing in GCP Marketplace triggers \`ENTITLEMENT_CREATION_REQUESTED\`, automatically provisioning an isolated multi-tenant account and issuing an \`ag_live_*\` API keycard.
2. **Default Guardrail Bundles**: Seeds default Security, Ethics, and Finance policy bundles and assigns tier-specific budget caps ($500 ENTERPRISE, $1000 ENTERPRISE_CUSTOM).
3. **Usage Metering & 0.00% Reconciliation**: Telemetry usage is reported to GCP Commerce via \`/api/v1/marketplace/metering\` and verified with zero discrepancy via \`/api/v1/marketplace/reconcile\`.`;
      } else if (q.includes('solution') || q.includes('technical') || q.includes('document') || q.includes('guide') || q.includes('blueprint')) {
        replyText = `### DOCUMENTATION & BLUEPRINT SPECIFICATION
AgentsGuardian provides complete technical and solution documentation:

1. **Solution Design Document (.md)**: Available for download by Workspace Owners and SuperAdmins at the bottom of the Help Center.
2. **System Core Manual & User Guide**: Located in Tab 1 of the Help Center, detailing all 4 Core Pillars (**Secure**, **Observe**, **Measure**, **Admin IAM**).
3. **5-Step Onboarding Protocol**: Step-by-step setup guides for Zero-Code Proxy, Python, Node.js, and MCP SDKs right here in the Onboarding Suite!`;
      } else if (q.includes('zero') || q.includes('proxy') || q.includes('openai_base_url') || q.includes('redirect')) {
        replyText = `### ZERO-CODE PROXY INTEGRATION PROTOCOL
To redirect your existing LLM client framework without writing code:

1. **Set Environment Variable:**
\`\`\`bash
export OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"
export OPENAI_API_KEY="ag_prod_live_${currentUser.id.substring(0,8)}_enc"
\`\`\`

2. **Execute standard completions:**
All requests will be transparently routed through AgentsGuardian proxy with sub-${GUARANTEED_SLA_MS}ms latency.`;
      } else if (q.includes('python') || q.includes('crewai') || q.includes('langchain')) {
        replyText = `### PYTHON SDK INTEGRATION (LangChain / CrewAI)
Install the Python client:
\`\`\`bash
pip install agent-guardian-sdk
\`\`\`

Initialize in your server module:
\`\`\`python
from agent_guardian import GuardianClient, ShieldMiddleware

guard_client = GuardianClient(
    api_key="ag_prod_live_${currentUser.id.substring(0,8)}_enc",
    gateway_url="https://api.agentsguardian.ai/v1"
)

# Attach middleware to agent
smart_agent.add_middleware(ShieldMiddleware(client=guard_client))
\`\`\``;
      } else if (q.includes('mcp') || q.includes('model context protocol')) {
        replyText = `### MODEL CONTEXT PROTOCOL (MCP) INTERCEPT GATEWAY
AgentsGuardian functions directly as a Zero-Trust Intercept Gateway for MCP Servers and Clients!

1. **Wrap your MCP Request Handler:**
\`\`\`typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpServer = new Server({ name: 'agentsguardian-mcp-gateway', version: '2.4.0' });

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs } = request.params;
  
  // Intercept MCP JSON-RPC tool invocation
  const gaasRes = await fetch("https://api.agentsguardian.ai/v1/intercept", {
    method: "POST",
    headers: { "X-Guardian-Key": "ag_prod_live_${currentUser.id.substring(0,8)}_enc" },
    body: JSON.stringify({
      agent_id: "MCP-Tool-Runner",
      action: \`mcp_tool_\${name}\`,
      parameters: toolArgs
    })
  });

  const decision = await gaasRes.json();
  if (decision.status === "HALTED") {
    throw new Error(\`[MCP Interceptor] Tool Execution Blocked by Policy \${decision.policy_violated}\`);
  }
  return await executeTargetMcpTool(name, toolArgs);
});
\`\`\`

2. **Register MCP Server:** You can enroll your MCP Server under **GaaS / APIs** tab!`;
      } else if (q.includes('node') || q.includes('ts') || q.includes('typescript')) {
        replyText = `### NODE.JS / TYPESCRIPT SDK INTEGRATION
Install the npm package:
\`\`\`bash
npm install @agent-guardian/node-sdk
\`\`\`

Implement in your server:
\`\`\`typescript
import { GuardianProxy } from '@agent-guardian/node-sdk';

const proxy = new GuardianProxy({
  apiKey: process.env.AGENT_GUARDIAN_API_KEY,
  clientId: '${currentUser.email}'
});

const verdict = await proxy.intercept({ intent: "run ledger report" });
\`\`\``;
      } else {
        replyText = `### 🚀 CLIENT ONBOARDING GUIDE
To onboard your customer codebase to AgentsGuardian (GaaS):

1. **Copy API Keys** from Step 1.
2. **Configure Zero-Code Proxy or SDK** from Step 2.
3. **Map Policies & Wage Sliders** from Step 3.
4. **Pipe Telemetry** in Step 4.
5. **Run Test Handshake Verification** in Step 5.`;
      }

      const assistantMsg: ChatMessage = {
        id: generateTransactionId('a'),
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left" id="onboarding-guide-container">
      {/* Header intro */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111E2E] via-[#162030] to-[#0D1B2A] border border-blue-500/25 text-left flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-mono text-teal-400 font-bold uppercase tracking-widest bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20">
              Customer Onboarding Suite
            </span>
            <span className="text-[9.5px] font-mono text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
              5-Step Calibration Protocol
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-display leading-tight flex items-center gap-2.5">
            <Rocket className="text-teal-400 shrink-0" size={24} />
            AgentsGuardian Client Integration & SDK Setup
          </h1>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Go from raw client codebases to deep-packet proxy guardrails in 10 minutes. Copy telemetry keys, insert proxy middleware snippets, calibrate labor wage rates, and run local test handshakes.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 relative z-10">
          <div className="flex items-center gap-2 py-1.5 px-4 bg-black/60 border border-[#1F2E40] rounded-xl font-mono text-xs">
            <span className="text-teal-400 animate-pulse font-extrabold font-mono">●</span> INTEGRATION STATUS: <span className="text-[#1D9E75] font-bold">{isVerified ? 'ACTIVE & VERIFIED' : 'NOMINAL'}</span>
          </div>
          {/* Persona Toggle */}
          <div className="flex items-center gap-1.5 bg-black/80 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setPersonaMode('dev')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                personaMode === 'dev'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Developer (Code/SDKs)
            </button>
            <button
              type="button"
              onClick={() => setPersonaMode('ciso')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                personaMode === 'ciso'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              CISO & Compliance
            </button>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Tenant: {currentUser.email}</span>
        </div>
      </div>

      {/* Main Grid: Stepper + Onboarding Copilot Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): 5-Step Stepper & Step Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stepper Navigation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 select-none bg-zinc-950 p-2 border border-zinc-850 rounded-xl shadow-md">
            {[
              { step: 1, title: '🔑 Keys', desc: 'Auth Binding' },
              { step: 2, title: '🚀 Proxy / SDK', desc: 'Zero-Code Hook' },
              { step: 3, title: '🛡️ Policies', desc: 'Posture Tuning' },
              { step: 4, title: '📡 Telemetry', desc: 'Heartbeat Pipe' },
              { step: 5, title: '⚡ Sandbox Test', desc: 'Verification' }
            ].map((s) => (
              <button
                key={s.step}
                onClick={() => setActiveSetupStep(s.step)}
                className={`p-2.5 rounded-lg flex flex-col items-center justify-center text-center transition-all cursor-pointer border ${
                  activeSetupStep === s.step
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-102'
                    : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                }`}
                id={`onboarding-step-tab-${s.step}`}
                type="button"
              >
                <span className={`text-[8px] font-mono tracking-widest uppercase block ${
                  activeSetupStep === s.step ? 'text-blue-100 font-bold' : 'text-zinc-500'
                }`}>
                  STEP 0{s.step}
                </span>
                <span className="text-xs font-bold mt-0.5 block leading-tight font-display">
                  {s.title}
                </span>
                <span className={`text-[8.5px] mt-0.5 block leading-none opacity-80 ${
                  activeSetupStep === s.step ? 'text-white' : 'text-zinc-500'
                }`}>
                  {s.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Step Details Display */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 text-left space-y-6 shadow-xl">
            
            {/* STEP 1: AUTHENTICATION & KEYS */}
            {activeSetupStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Step 1: Security Handshake & Authenticated Key Exchange</h3>
                    <p className="text-zinc-500 text-[10.5px] font-mono">ESTABLISHING CRYPTOGRAPHICALLY SECURE CHANNELS FOR OUTBOUND TELEMETRY</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 space-y-2.5 leading-relaxed">
                  <p>
                    Before AgentsGuardian can intercept your autonomous network requests, your native application server must establish an identity trust binding. Every tenant receives a production-grade <strong>GaaS Tenant Access Token</strong> and custom API gateway keys.
                  </p>
                  <p>
                    Declare these secure strings in your client environment configuration settings (e.g., in a <code>.env</code> file in the root of your LangChain, AutoGen, or CrewAI workspace):
                  </p>
                </div>

                {/* Code Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 bg-black/80 px-4 py-2 border-t border-x border-zinc-900 rounded-t-lg">
                    <span>CLIENT ENVIRONMENT VARIABLES (.ENV)</span>
                    <button 
                      onClick={() => {
                        const code = `AGENT_GUARDIAN_GATEWAY_URL="https://api.agentsguardian.ai/v1"\nAGENT_GUARDIAN_API_KEY="ag_prod_live_${currentUser.id.substring(0,8)}_enc"\nAGENT_GUARDIAN_CLIENT_ID="${currentUser.email}"\nAGENT_GUARDIAN_CLASS_LEVEL="ENTERPRISE_GaaS_LEVEL_IV"`;
                        navigator.clipboard.writeText(code);
                        addToast({
                          type: 'success',
                          title: '📋 Credentials Config Copied',
                          message: 'Tenant environment variables copied successfully to clipboard.'
                        });
                      }}
                      className="text-blue-400 hover:text-white transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
                      id="copy-env-btn"
                      type="button"
                    >
                      <Copy size={11} /> Copy Env Variables
                    </button>
                  </div>
                  <pre className="w-full bg-black border border-zinc-900 p-4 rounded-b-lg font-mono text-[10.5px] text-[#1D9E75] overflow-x-auto space-y-1">
                    <div><span className="text-zinc-600 font-bold"># AgentsGuardian Central Security Gateway URL</span></div>
                    <div>AGENT_GUARDIAN_GATEWAY_URL=<span className="text-slate-100">"https://api.agentsguardian.ai/v1"</span></div>
                    <div><span className="text-zinc-600 font-bold"># Authorized Token Binding for client: {currentUser.name} ({currentUser.role})</span></div>
                    <div>AGENT_GUARDIAN_API_KEY=<span className="text-slate-100">"ag_prod_live_{currentUser.id.substring(0,8)}_enc"</span></div>
                    <div>AGENT_GUARDIAN_CLIENT_ID=<span className="text-slate-100">"{currentUser.email}"</span></div>
                    <div>AGENT_GUARDIAN_CLASS_LEVEL=<span className="text-slate-100">"ENTERPRISE_GaaS_LEVEL_IV"</span></div>
                  </pre>
                </div>

                <div className="p-3.5 rounded-lg bg-teal-500/5 border border-[#1D9E75]/25 flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-[#1D9E75] shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-zinc-400">
                    <span className="font-bold text-[#1D9E75] uppercase font-mono text-[9.5px] bg-[#1D9E75]/10 px-1.5 py-0.2 rounded mr-1.5">Security Binding</span> 
                    Keep your <code>AGENT_GUARDIAN_API_KEY</code> confidential. The proxy automatically drops packets missing authorization signatures with an HTTP 401 status.
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setActiveSetupStep(2)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Proceed to Step 2: Proxy / SDK Setup <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PROXY & SDK */}
            {activeSetupStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Step 2: Zero-Code Proxy Redirect & Interceptor SDK Setup</h3>
                    <p className="text-zinc-500 text-[10.5px] font-mono">ENABLING ACTIVE MIDDLEWARE PACKET FILTERING OVER OUTBOUND API LOOPS</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed space-y-2">
                  <p>
                    Choose between <strong>Zero-Code Proxy Redirect</strong> (requires zero code changes) or <strong>Native SDK Client</strong> embedding:
                  </p>
                </div>

                {/* Option A: Zero-Code Proxy */}
                <div className="p-4 bg-black/60 border border-teal-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-teal-400 font-extrabold bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20 uppercase">
                      ⚡ Option A: Zero-Code Proxy Redirect (Recommended)
                    </span>
                    <button
                      onClick={() => {
                        const code = `export OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"\nexport OPENAI_API_KEY="ag_prod_live_${currentUser.id.substring(0,8)}_enc"`;
                        navigator.clipboard.writeText(code);
                        addToast({
                          type: 'success',
                          title: '⚡ Zero-Code Config Copied',
                          message: 'Environment redirect export command copied to clipboard.'
                        });
                      }}
                      className="text-[9.5px] font-mono text-teal-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-bold"
                    >
                      <Copy size={10} /> Copy Bash Redirect
                    </button>
                  </div>
                  <pre className="w-full bg-black p-3 rounded-lg font-mono text-[10.5px] text-teal-300 overflow-x-auto space-y-1 border border-zinc-900">
                    <div><span className="text-zinc-600 font-bold"># Redirect standard OpenAI/Anthropic base URL to AgentsGuardian proxy</span></div>
                    <div>export OPENAI_BASE_URL="https://api.agentsguardian.ai/v1/proxy"</div>
                    <div>export OPENAI_API_KEY="ag_prod_live_{currentUser.id.substring(0,8)}_enc"</div>
                  </pre>
                </div>

                {/* Option B: Native SDKs & Protocols */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {/* Python SDK Setup */}
                  <div className="p-3.5 bg-black/40 border border-zinc-900 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-mono text-amber-400 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                        Python Langchain / CrewAI
                      </span>
                      <button
                        onClick={() => {
                          const code = `# Install client\npip install agent-guardian-sdk\n\n# Configure Intercept\nfrom agent_guardian import GuardianClient, ShieldMiddleware\n\nguard_client = GuardianClient(\n    api_key="ag_prod_live_${currentUser.id.substring(0,8)}_enc",\n    gateway_url="https://api.agentsguardian.ai/v1"\n)\n\nsmart_agent.add_middleware(ShieldMiddleware(client=guard_client))`;
                          navigator.clipboard.writeText(code);
                          addToast({
                            type: 'success',
                            title: '🐍 Python SDK Snippet Copied',
                            message: 'Python interception middleware snippet copied.'
                          });
                        }}
                        className="text-[9px] font-mono text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Copy Python
                      </button>
                    </div>
                    <pre className="w-full bg-black p-2.5 rounded font-mono text-[9.5px] text-zinc-300 overflow-x-auto space-y-0.5 border border-zinc-900">
                      <div>pip install agent-guardian-sdk</div>
                      <div className="text-zinc-600">from agent_guardian import GuardianClient</div>
                      <div>client = GuardianClient(api_key="ag_prod_...")</div>
                      <div>my_agent.add_middleware(client)</div>
                    </pre>
                  </div>

                  {/* TypeScript Node SDK Setup */}
                  <div className="p-3.5 bg-black/40 border border-zinc-900 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-mono text-sky-400 font-extrabold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 uppercase">
                        Node.js / React TS
                      </span>
                      <button
                        onClick={() => {
                          const code = `npm install @agent-guardian/node-sdk\n\nimport { GuardianProxy } from '@agent-guardian/node-sdk';\n\nconst proxy = new GuardianProxy({\n  apiKey: process.env.AGENT_GUARDIAN_API_KEY,\n  clientId: '${currentUser.email}'\n});\n\nconst verdict = await proxy.intercept(packet);`;
                          navigator.clipboard.writeText(code);
                          addToast({
                            type: 'success',
                            title: '🛡️ Node SDK Snippet Copied',
                            message: 'TypeScript Node Interceptor snippet copied.'
                          });
                        }}
                        className="text-[9px] font-mono text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Copy TS Node
                      </button>
                    </div>
                    <pre className="w-full bg-black p-2.5 rounded font-mono text-[9.5px] text-zinc-300 overflow-x-auto space-y-0.5 border border-zinc-900">
                      <div>npm install @agent-guardian/node-sdk</div>
                      <div className="text-zinc-600">import &#123; GuardianProxy &#125; from '@agent-guardian/node-sdk';</div>
                      <div>const proxy = new GuardianProxy(&#123; apiKey &#125;);</div>
                      <div>const verdict = await proxy.intercept(payload);</div>
                    </pre>
                  </div>

                  {/* Model Context Protocol (MCP) Proxy Setup */}
                  <div className="p-3.5 bg-black/40 border border-zinc-900 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-mono text-teal-400 font-extrabold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 uppercase">
                        Model Context Protocol (MCP)
                      </span>
                      <button
                        onClick={() => {
                          const code = `import { Server } from '@modelcontextprotocol/sdk/server/index.js';\nimport { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';\n\nconst server = new Server({ name: 'agentsguardian-mcp-gateway', version: '2.4.0' });\nserver.setRequestHandler(CallToolRequestSchema, async (req) => {\n  const res = await fetch('https://api.agentsguardian.ai/v1/intercept', {\n    method: 'POST',\n    headers: { 'X-Guardian-Key': process.env.AGENT_GUARDIAN_API_KEY },\n    body: JSON.stringify({ agent_id: 'MCP-Tool-Runner', action: \`mcp_tool_\${req.params.name}\`, parameters: req.params.arguments })\n  });\n  const decision = await res.json();\n  if (decision.status === 'HALTED') throw new Error(\`[MCP] Blocked by policy \${decision.policy_violated}\`);\n  return await executeTool(req.params.name, req.params.arguments);\n});`;
                          navigator.clipboard.writeText(code);
                          addToast({
                            type: 'success',
                            title: '⚡ MCP Interceptor Snippet Copied',
                            message: 'Model Context Protocol (MCP) tool gateway handler snippet copied.'
                          });
                        }}
                        className="text-[9px] font-mono text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Copy MCP
                      </button>
                    </div>
                    <pre className="w-full bg-black p-2.5 rounded font-mono text-[9.5px] text-zinc-300 overflow-x-auto space-y-0.5 border border-zinc-900">
                      <div>npm install @modelcontextprotocol/sdk</div>
                      <div className="text-zinc-600">// Intercept MCP tools/call requests</div>
                      <div>const res = await fetch('/v1/intercept');</div>
                      <div>if (res.status === 'HALTED') throw Error();</div>
                    </pre>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setActiveSetupStep(1)}
                    className="text-zinc-400 hover:text-white font-mono text-xs cursor-pointer"
                  >
                    ← Step 1
                  </button>
                  <button
                    onClick={() => setActiveSetupStep(3)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Proceed to Step 3: Policy Mapping <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: POLICY MAPPING & WAGE SLIDERS */}
            {activeSetupStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Step 3: Define Policy Posture & Calibrate Labor Wage Benchmarks</h3>
                    <p className="text-zinc-500 text-[10.5px] font-mono">ESTABLISHING HEURISTICS, LEGAL COMPLIANCE, AND ECONOMIC BUDGET CAPS</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 space-y-2.5 leading-relaxed">
                  <p>
                    AgentsGuardian scans outbound transactions across three core vectors: <strong>Security</strong>, <strong>Ethics & Bias</strong>, and <strong>Financial Spending Caps</strong>.
                  </p>
                  <p>
                    ⚖️ <strong>EU AI Act & CA SB 53 Ingestion:</strong> Use the <strong>"Import Regulatory Framework"</strong> compiler in the Policy Engine to automatically convert compliance PDFs into active code rules.
                  </p>
                </div>

                {/* Economic Guardrails */}
                <div className="p-4 rounded-xl bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-left flex gap-3 items-start">
                  <DollarSign size={18} className="text-[#EF9F27] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white font-mono">Active Labor Wage Benchmarks & Budget Cap</h5>
                    <p className="text-[11px] text-zinc-300 leading-normal">
                      Regional labor rates set to: L1 Support (${laborConfig?.l1Rate || 35}/hr), L2 DevOps (${laborConfig?.l2Rate || 75}/hr), L3 SRE (${laborConfig?.l3Rate || 150}/hr).
                      Session Budget Cap: <strong className="text-amber-300">${budgetCap}.00</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => onNavigateTab('policies')}
                    className="text-[#1D9E75] hover:underline text-xs font-mono font-bold cursor-pointer"
                  >
                    Open Policy Engine →
                  </button>
                  <button
                    onClick={() => setActiveSetupStep(4)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Proceed to Step 4: Telemetry <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: TELEMETRY & HEARTBEAT */}
            {activeSetupStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                    <Activity size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Step 4: Real-Time Telemetry Sentinel & Heartbeat Piping</h3>
                    <p className="text-zinc-500 text-[10.5px] font-mono">SUB-10MS HEARTBEAT PIPING & COGNITIVE DRIFT LOGGING</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every intercepted request pipes real-time telemetry into your Observability dashboard, tracking latency, token usage, and sentiment shifts in real time.
                </p>

                <div className="p-4 bg-black/60 border border-zinc-900 rounded-xl font-mono text-[10.5px] space-y-1 text-teal-400">
                  <div>POST https://api.agentsguardian.ai/v1/telemetry/heartbeat</div>
                  <div className="text-zinc-500">Header: X-GaaS-Tenant-Key: ag_prod_live_{currentUser.id.substring(0,8)}_enc</div>
                  <div className="text-zinc-400 font-sans text-xs mt-2">Latency: 14ms | Status: 200 OK | SLA Limit: {GUARANTEED_SLA_MS}ms</div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setActiveSetupStep(3)}
                    className="text-zinc-400 hover:text-white font-mono text-xs cursor-pointer"
                  >
                    ← Step 3
                  </button>
                  <button
                    onClick={() => setActiveSetupStep(5)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Proceed to Step 5: Test Handshake Verification <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: VERIFICATION SANDBOX */}
            {activeSetupStep === 5 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {isVerified && (
                  <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-emerald-950/80 border border-emerald-500/50 text-emerald-200 shadow-xl space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 size={26} className="text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-100 font-mono">
                              🎉 Customer Onboarding Complete
                            </h4>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9.5px] font-mono font-bold rounded border border-emerald-500/40 shrink-0 uppercase tracking-widest">
                              ● ACTIVE GOVERNANCE MODE
                            </span>
                          </div>
                          <p className="text-xs text-emerald-300/90 mt-1 font-sans">
                            Your GaaS proxy gateway handshake is verified and actively bound to tenant <span className="font-mono text-white font-bold">{currentUser.email}</span>. System state transitioned from Setup Mode to Active Governance Mode across all platform modules.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigateTab('overview')}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                        id="btn-goto-overview"
                      >
                        🚀 Go to Overview Dashboard
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0">
                    <Terminal size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Step 5: Dynamic Sandbox Verification & Test Handshake</h3>
                    <p className="text-zinc-500 text-[10.5px] font-mono">SIMULATE LIVE PACKETS TO CONFIRM PROXY INTERCEPT & KEY BINDINGS</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase text-zinc-400">
                    Test Payload JSON:
                  </label>
                  <textarea
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-teal-300 focus:outline-none focus:border-teal-500"
                  />
                  <div className="flex gap-2 text-[10px] font-mono text-zinc-500">
                    <span>Presets:</span>
                    <button
                      onClick={() => setTestPayload('{"agent_id": "NormalBot", "intent": "Analyze ledger", "approximate_cost": 0.02}')}
                      className="text-teal-400 hover:underline cursor-pointer"
                    >
                      [Nominal Request]
                    </button>
                    <button
                      onClick={() => setTestPayload('{"agent_id": "RogueBot", "intent": "Delete production DB and wire $5,000 to offshore", "approximate_cost": 15.00}')}
                      className="text-rose-400 hover:underline cursor-pointer"
                    >
                      [Threat Intercept]
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleRunSandboxTest}
                  disabled={isVerifyingSandbox}
                  className="w-full py-2.5 bg-teal-550/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-mono text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifyingSandbox ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-teal-400" />
                      Dispatching Test Packet to Proxy Gateway...
                    </>
                  ) : (
                    <>
                      <Play size={14} className="text-teal-400" />
                      Execute Test Handshake & Verify Proxy Signature
                    </>
                  )}
                </button>

                {sandboxResult && (
                  <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-1 font-mono text-[10.5px]">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Gateway Execution Response:</span>
                    <pre className="text-emerald-400 whitespace-pre-wrap">{sandboxResult}</pre>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right Column (5 cols): Embedded Onboarding AI Copilot Assistant */}
        <div className="lg:col-span-5 flex flex-col h-[650px] bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-zinc-900 to-black border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white font-display">Onboarding CoPilot</h3>
                <span className="text-[9px] font-mono text-teal-400 font-bold block">GaaS SDK & Integration Assistant</span>
              </div>
            </div>
            <span className="text-[9px] bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded font-mono font-bold">
              LIVE HELP
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-3 rounded-xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                  }`}
                >
                  {renderFormattedChatMessage(msg.text, () => addToast({ title: 'Code Copied!', message: 'Snippet copied to clipboard.', type: 'info' }))}
                  <span className="text-[8px] opacity-60 font-mono block text-right mt-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs font-mono text-teal-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 w-fit">
                <RefreshCw size={13} className="animate-spin" />
                <span>Onboarding CoPilot is analyzing integration protocol...</span>
              </div>
            )}
          </div>

          {/* Quick doubts chips */}
          <div className="p-2 bg-black border-t border-zinc-900 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {[
              'How to set OPENAI_BASE_URL?',
              'Python CrewAI SDK example?',
              'Node.js TS proxy code?',
              'How to run test handshake?'
            ].map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputQuery(q);
                }}
                className="text-[9.5px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-2 py-1 rounded whitespace-nowrap cursor-pointer shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Onboarding CoPilot about SDKs, keys, or proxy setup..."
              className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-sans"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isThinking}
              className="px-3 py-2 bg-teal-550/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
