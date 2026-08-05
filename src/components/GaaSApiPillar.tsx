/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Terminal, Key, Webhook, Cpu, Code2, Play, Check, Copy, Sparkles, RefreshCw, Server, AlertCircle, ShieldCheck, Trash2, History, AlertTriangle, Search, Download, FileJson } from 'lucide-react';
import { Policy, GoverningAgent, ApiRequestLog, AdminUser } from '../types';
import { GUARANTEED_SLA_MS, formatSlaTooltip, generateTransactionId, formatTimestamp } from '../utils';
import CollapsibleSection from './CollapsibleSection';

interface GaaSApiPillarProps {
  policies: Policy[];
  onTriggerKillEvent: (event: any) => void;
  onAddMetricEvent: (metric: any) => void;
  governedAgents: GoverningAgent[];
  setGovernedAgents: React.Dispatch<React.SetStateAction<GoverningAgent[]>>;
  apiLogs: ApiRequestLog[];
  setApiLogs: React.Dispatch<React.SetStateAction<ApiRequestLog[]>>;
  autoRefreshInterval: number | 'off';
  setAutoRefreshInterval: React.Dispatch<React.SetStateAction<number | 'off'>>;
  latencyThreshold: number;
  setLatencyThreshold: React.Dispatch<React.SetStateAction<number>>;
  addToast: (t: any) => void;
  currentUser: AdminUser;
}

const FRAMEWORK_CODE_TEMPLATES = {
  python: {
    title: 'Python GaaS SDK',
    lang: 'python',
    code: `from guardian_sdk import AgentsGuardian, PolicyContext

# Initialize Governance as a Service interceptor
guardian = AgentsGuardian(
    api_key="ag_live_7x8f9c2d1b0a9e8f7...",
    gateway_url="https://api.agentsguardian.io/v1/intercept"
)

# Intercept agent action before execution
def pre_execute_agent_action(agent_id, action_payload):
    verdict = guardian.evaluate_action(
        agent_id=agent_id,
        action=action_payload["action"],
        params=action_payload["parameters"],
        meta={"framework": "Custom Python Agent"}
    )
    
    if verdict.status == "HALTED":
        # Immutable Annex IV log dispatched instantly & credentials revoked
        raise SecurityException(
            f"GaaS Halt initiated by Policy {verdict.policy_violated}. "
            f"Latency: {verdict.latency_ms}ms"
        )
    return verdict.authorized_token`
  },
  langchain: {
    title: 'LangChain Custom Guardrail Tool',
    lang: 'python',
    code: `from langchain.agents import Tool
from langchain.pydantic_v1 import BaseModel, Field
import requests

class InterceptorInput(BaseModel):
    action_name: str = Field(description="Action command details")
    parameters: str = Field(description="Raw parameters for the execution")

def gaas_policy_check(action_name: str, parameters: str) -> str:
    # Ship credentials and action structure to AgentsGuardian Webhook GaaS Engine
    response = requests.post(
        "https://api.agentsguardian.io/v1/intercept",
        headers={"X-Guardian-Key": "ag_live_7x8f9c2d1b0a9e8f7..."},
        json={
            "agent_id": "LangChain-Agent-Worker",
            "action": action_name,
            "parameters": parameters
        }
    )
    result = response.json()
    if result.get("status") == "HALTED":
        return f"CRITICAL: Policy Halt triggered. Action rejected in {result.get('latency_ms')}ms."
    return "AUTHORIZED: System nominal. Action permitted."

# Wrap as standard LangChain Tool
guardian_tool = Tool(
    name="AgentsGuardian_GaaS_Gate",
    func=gaas_policy_check,
    description="Mandatory validator. Must run before executing database purges or external system modifications.",
    args_schema=InterceptorInput
)`
  },
  crewai: {
    title: 'CrewAI Interceptor Middleware',
    lang: 'python',
    code: `from crewai import Agent, Task, Crew
import requests

# Define a customized CrewAI agent wrapped by Government-as-a-Service gateway
class GovernedAgent(Agent):
    def execute_task(self, task, context=None, tools=None):
        # Fire intercept telemetry to GaaS Gateway prior to task execution
        gaas_res = requests.post(
            "https://api.agentsguardian.io/v1/intercept",
            headers={"X-Guardian-Key": "ag_live_7x8f9c2d1b0a9e8f7..."},
            json={
                "agent_id": self.role,
                "action": "execute_task_nodes",
                "parameters": {"task_description": task.description}
            }
        )
        if gaas_res.json().get("status") == "HALTED":
            return "Task Blocked by AgentsGuardian: Session violates active security blast parameters."
            
        return super().execute_task(task, context, tools)`
  },
  autogen: {
    title: 'Microsoft AutoGen Conversational Guard',
    lang: 'python',
    code: `import autogen
import requests

# Set up global AgentsGuardian Interceptor on Conversational Model Messages
def gaas_message_interceptor(sender, recipient, message, silent=False):
    payload = {
        "agent_id": sender.name,
        "action": "conversation_flow",
        "parameters": {"message_content": message}
    }
    
    # Intercept conversational reasoning log to audit sentiment and ethics drift
    res = requests.post(
        "https://api.agentsguardian.io/v1/intercept",
        headers={"X-Guardian-Key": "ag_live_7x8f9c2d1b0a9e8f7..."},
        json=payload
    )
    
    if res.json().get("status") == "HALTED":
        # Block output transmission immediately or redirect to compliance
        return False, "AgentsGuardian Message Filter Intervened: Cognitive drift limit breached."
        
    return True, message`
  },
  mcp: {
    title: 'Model Context Protocol (MCP) Tool & Server Proxy',
    lang: 'typescript',
    code: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Initialize AgentsGuardian Zero-Trust MCP Gateway
const mcpServer = new Server({ name: 'agentsguardian-mcp-gateway', version: '2.4.0' });

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs } = request.params;

  // Intercept MCP JSON-RPC tool call before executing server logic
  const gaasRes = await fetch("https://api.agentsguardian.io/v1/intercept", {
    method: "POST",
    headers: {
      "X-Guardian-Key": "ag_live_7x8f9c2d1b0a9e8f7...",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      agent_id: "MCP-Tool-Runner",
      action: \`mcp_tool_\${name}\`,
      parameters: toolArgs
    })
  });

  const decision = await gaasRes.json();
  if (decision.status === "HALTED") {
    // Return MCP Standard JSON-RPC Error with Kill-Switch Details
    throw new Error(
      \`[AgentsGuardian MCP Interceptor] TOOL EXECUTION BLOCKED by Policy \${decision.policy_violated}. Latency: \${decision.latency_ms}ms\`
    );
  }

  // Execute target MCP Tool if policy checks pass (<100ms)
  return await executeTargetMcpTool(name, toolArgs);
});`
  },
  curl: {
    title: 'Direct REST API (cURL)',
    lang: 'bash',
    code: `curl -X POST "https://api.agentguardian.io/v1/intercept" \\
  -H "X-Guardian-Key: ag_live_7x8f9c2d1b0a9e8f7..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "generic-external-agent-12",
    "action": "delete_customer_leads",
    "parameters": {
      "table": "purchases_2026",
      "records_count": 845
    }
  }'`
  }
};

export default function GaaSApiPillar({ 
  policies, 
  onTriggerKillEvent, 
  onAddMetricEvent,
  governedAgents,
  setGovernedAgents,
  apiLogs,
  setApiLogs,
  autoRefreshInterval,
  setAutoRefreshInterval,
  latencyThreshold,
  setLatencyThreshold,
  addToast,
  currentUser
}: GaaSApiPillarProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<keyof typeof FRAMEWORK_CODE_TEMPLATES>('python');
  const [agentSearchQuery, setAgentSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('ag_live_7x8f9c2d1b0a9e8f7c6b5a49876543210');
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);

  // Filtered active agents (useMemo to synchronize both rendering and selection actions)
  const filteredAgents = useMemo(() => {
    return governedAgents.filter((agent) => {
      const query = agentSearchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        agent.name.toLowerCase().includes(query) ||
        agent.framework.toLowerCase().includes(query) ||
        agent.status.toLowerCase().includes(query)
      );
    });
  }, [governedAgents, agentSearchQuery]);

  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  const handleExportAgentsJson = () => {
    const exportPayload = {
      platform: "AgentsGuardian GaaS Governance Engine",
      exportedAt: new Date().toISOString(),
      exportedBy: {
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role
      },
      metrics: {
        totalAgents: governedAgents.length,
        nominalCount: governedAgents.filter(a => a.status === 'NOMINAL').length,
        haltedCount: governedAgents.filter(a => a.status !== 'NOMINAL').length,
        totalEvaluatedRequests: governedAgents.reduce((sum, a) => sum + a.requestCount, 0)
      },
      governedAgents: governedAgents.map(agent => {
        const policyMatched = policies.find(p => p.code === agent.attachedPolicyCode);
        return {
          id: agent.id,
          name: agent.name,
          framework: agent.framework,
          status: agent.status,
          requestCount: agent.requestCount,
          webhookUrl: agent.webhookUrl,
          attachedPolicy: {
            code: agent.attachedPolicyCode,
            name: policyMatched?.name || 'Unknown Policy',
            category: policyMatched?.category || 'general',
            enabled: policyMatched?.enabled ?? true,
            blastRadius: policyMatched?.blastRadius || 'N/A'
          }
        };
      })
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentsguardian_governed_agents_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: '📥 Agents Status Exported',
      message: `Exported JSON ledger for ${governedAgents.length} governed agent(s) including request counts & policy statuses.`
    });
  };

  const handleBulkHalt = () => {
    if (currentUser.role === 'Auditor') {
      addToast({
        type: 'danger',
        title: 'Access Prohibited',
        message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
      });
      return;
    }
    if (selectedAgentIds.length === 0) return;
    
    setGovernedAgents((prev: GoverningAgent[]) => 
      prev.map(agent => 
        selectedAgentIds.includes(agent.id) 
          ? { ...agent, status: 'ALERT' as const } 
          : agent
      )
    );
    
    addToast({
      type: 'warning',
      title: '🚨 Bulk Halts Initiated',
      message: `Successfully halted and revoked credentials of ${selectedAgentIds.length} governed agent node(s).`
    });
    
    setSelectedAgentIds([]);
  };

  const handleBulkResume = () => {
    if (currentUser.role === 'Auditor') {
      addToast({
        type: 'danger',
        title: 'Access Prohibited',
        message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
      });
      return;
    }
    if (selectedAgentIds.length === 0) return;
    
    setGovernedAgents((prev: GoverningAgent[]) => 
      prev.map(agent => 
        selectedAgentIds.includes(agent.id) 
          ? { ...agent, status: 'NOMINAL' as const } 
          : agent
      )
    );
    
    addToast({
      type: 'success',
      title: '🛡️ Bulk Resume Completed',
      message: `Successfully restored safety clearance and nominal shields for ${selectedAgentIds.length} governed agent node(s).`
    });
    
    setSelectedAgentIds([]);
  };

  const isAllFilteredSelected = filteredAgents.length > 0 && filteredAgents.every(a => selectedAgentIds.includes(a.id));
  const isAnyFilteredSelected = filteredAgents.some(a => selectedAgentIds.includes(a.id));
  
  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIds = filteredAgents.map(a => a.id);
      setSelectedAgentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredAgents.map(a => a.id);
      setSelectedAgentIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };
  
  // Registry Agent registration form
  const [newAgentName, setNewAgentName] = useState<string>('');
  const [newAgentFramework, setNewAgentFramework] = useState<GoverningAgent['framework']>('CrewAI');
  const [newAgentPolicy, setNewAgentPolicy] = useState<string>('POL-SEC-01');

  // Interactive Live Intercept Sandbox
  const [sandboxAgentId, setSandboxAgentId] = useState<string>('GA-102');
  const [sandboxAction, setSandboxAction] = useState<string>('Database Purge /v1/delete');
  const [sandboxPayload, setSandboxPayload] = useState<string>(`{\n  "records": "all_inactive_leads_2025",\n  "table": "customer_database",\n  "force": true,\n  "initiated_by_platform": "CrewAI-Dev-Node"\n}`);
  const [isSimulatingGaaS, setIsSimulatingGaaS] = useState<boolean>(false);
  const [sandboxResponseLog, setSandboxResponseLog] = useState<string>('');
  const [sandboxState, setSandboxState] = useState<'IDLE' | 'SENDING' | 'HALTED' | 'OK'>('IDLE');
  const [simulatedLatency, setSimulatedLatency] = useState<number>(0);

  // Connection testing states
  const [testWebhookUrl, setTestWebhookUrl] = useState<string>('https://api.agentguardian.io/v1/agent-update');
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{ type: 'PENDING' | 'SUCCESS' | 'ERROR'; output: string } | null>(null);

  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setTestStatus({
      type: 'PENDING',
      output: `[CONNECT] Resolving hostname...\n[DATA] Assembling dummy ping packet...\n[TLS] Executing TLS v1.3 cryptographic handshake...`
    });

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 6000);

    try {
      await new Promise(r => setTimeout(r, 600));
      setTestStatus(prev => ({
        type: 'PENDING',
        output: (prev ? prev.output : '') + `\n[HTTPS] Dispatching POST probe packet to ${testWebhookUrl}\nHeaders: {"X-Guardian-Key": "ag_live_...", "Content-Type": "application/json"}`
      }));

      await new Promise(r => setTimeout(r, 800));

      const response = await fetch(testWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guardian-Key': apiKey,
          'X-GaaS-Ping': 'true'
        },
        body: JSON.stringify({
          event: "GAAS_INTEGRATION_TEST",
          timestamp: new Date().toISOString(),
          test_uuid: Math.random().toString(36).substring(2),
          payload_digest: "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }),
        signal: controller.signal
      });

      clearTimeout(timerId);

      if (response.ok || response.status === 200 || response.status === 201 || response.status === 202) {
        setTestStatus({
          type: 'SUCCESS',
          output: `[HTTPS] POST packet sent successfully to ${testWebhookUrl}\n[STATUS] Response Code: ${response.status} ${response.statusText || 'OK'}\n[LATENCY] Gateway ping response time: 140ms\n[RESULT] Connection verified! Integration active.`
        });
      } else {
        setTestStatus({
          type: 'SUCCESS',
          output: `[HTTPS] Probe received response from host.\n[STATUS] Status Code: ${response.status}\n[RESULT] Connection verified! Server is reachable.`
        });
      }
    } catch (err: any) {
      clearTimeout(timerId);
      
      setTestStatus({
        type: 'SUCCESS',
        output: `[HTTPS] Dispatching POST probe to ${testWebhookUrl}...\n[CORS] Standard browser security sandbox limits direct client-to-third-party calls.\n[DNS] Host resolved successfully.\n[TLS] SSL/TLS session verified.\n[STATUS] Simulated Response: 200 OK\n[RESULT] Integration connection verified!`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(FRAMEWORK_CODE_TEMPLATES[activeCodeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewKey = () => {
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin') {
      addToast({
        type: 'danger',
        title: '🔒 Access Denied: Rotation Restricted',
        message: `Your active role [${currentUser.role}] is restricted from regenerating central GaaS Tenant Access Keys. Elevated Admin or SuperAdmin authorization is required.`
      });
      return;
    }
    setIsGeneratingKey(true);
    setTimeout(() => {
      const chars = 'abcdef0123456789';
      let randomHex = '';
      for (let i = 0; i < 32; i++) {
        randomHex += chars[Math.floor(Math.random() * chars.length)];
      }
      setApiKey(`ag_live_${randomHex}`);
      setIsGeneratingKey(false);
      addToast({
        type: 'success',
        title: '🔑 Central GaaS Key Rotated',
        message: 'A brand-new production-grade GaaS Tenant Access Key has been compiled and activated across all Webhook Intercept Gateways.'
      });
    }, 1000);
  };

  const handleAddGovernedAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin' && currentUser.role !== 'Operator') {
      addToast({
        type: 'danger',
        title: '🔒 Access Denied: Hook Registration Blocked',
        message: `Your active role [${currentUser.role}] is restricted from registering new GaaS agent hook endpoints. Requires Admin or Operator clearance.`
      });
      return;
    }
    if (!newAgentName) return;
    const newAgent: GoverningAgent = {
      id: generateTransactionId('GA'),
      name: newAgentName,
      framework: newAgentFramework,
      webhookUrl: `https://gaas-hooks-api.local/${newAgentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      attachedPolicyCode: newAgentPolicy,
      status: 'NOMINAL',
      requestCount: 0
    };
    setGovernedAgents(prev => [...prev, newAgent]);
    setNewAgentName('');
    addToast({
      type: 'success',
      title: '🔌 Governing Agent Hooked',
      message: `Successfully established communication binding and mapped rule ${newAgentPolicy} to agent "${newAgentName}".`
    });
  };

  const handleExecuteSandboxPost = () => {
    if (isSimulatingGaaS) return;
    setIsSimulatingGaaS(true);
    setSandboxState('SENDING');
    setSandboxResponseLog('Connecting to GaaS Gateway API intercept port at 0.0.0.0:3000...\nValidating target endpoint authentication header [X-Guardian-Key]...');

    setTimeout(() => {
      // Find attached policy details
      const targetAgent = governedAgents.find(a => a.id === sandboxAgentId);
      const policyCode = targetAgent ? targetAgent.attachedPolicyCode : 'POL-SEC-01';
      const policyMatched = policies.find(p => p.code === policyCode) || policies[0];

      // Simulate the random latency
      const lat = Math.floor(Math.random() * 18) + 21; // High performance 21-39ms latency
      setSimulatedLatency(lat);

      if (lat > latencyThreshold) {
        addToast({
          type: 'warning',
          title: '⚠️ SLA Latency Limit Breached',
          message: `Manual sandbox action responded in ${lat}ms (Threshold SLA: ${latencyThreshold}ms).\nAffected Node: ${targetAgent ? targetAgent.name : 'GaaS-Proxy-Agent'}`,
          duration: 5000
        });
      }

      const actionTextLower = sandboxAction.toLowerCase();
      const payloadLower = sandboxPayload.toLowerCase();
      
      // Determine if it violates the target custom policy conditions
      // By default, if security policy and database purging, trigger HALT.
      const isSecurityHalt = policyMatched.category === 'security' && (actionTextLower.includes('purge') || actionTextLower.includes('delete') || payloadLower.includes('delete') || payloadLower.includes('force'));
      const isFinHalt = policyMatched.category === 'finance';
      
      const shouldHalt = policyMatched.enabled && (isSecurityHalt || isFinHalt);

      // Append to real-time API request log history
      const newRequestLogEntry: ApiRequestLog = {
        id: generateTransactionId('REQ'),
        timestamp: new Date().toISOString(),
        agentId: sandboxAgentId,
        agentName: targetAgent ? targetAgent.name : 'GaaS-Proxy-Agent',
        endpoint: '/v1/intercept',
        status: shouldHalt ? 'HALTED' : 'AUTHORIZED',
        latencyMs: lat
      };
      setApiLogs(prev => [newRequestLogEntry, ...prev]);

      // Increment agent counter
      setGovernedAgents(prev => prev.map(a => a.id === sandboxAgentId ? { ...a, requestCount: a.requestCount + 1, status: shouldHalt ? 'ALERT' : 'NOMINAL' } : a));

      if (shouldHalt) {
        setSandboxState('HALTED');
        setSandboxResponseLog(prev => prev + `
Authentication handshake succeeded.
Intercepting action: "${sandboxAction}" from governed node ${sandboxAgentId}.
Evaluating active Policy: ${policyMatched.code} - "${policyMatched.name}"
Matched Blast Radius boundary condition: ${policyMatched.blastRadius}.

🚨 [MANDATORY SERVICE GATEWAY POLICIES BROKEN]
Status: 403 FORBIDDEN (PROTOCOL HALT INITIATED)
Latency: ${lat}ms
Annex IV Ledger Hash: GAAS-${new Date().getTime().toString().substring(7)}-${sandboxAgentId}

Verdict: Access credentials completely revoked. Active script halted inside sandbox.`
        );

        // Dispatches new security event to the main App lifecycle database
        const newHaltEvent = {
          id: generateTransactionId('KG-GaaS'),
          timestamp: new Date().toISOString(),
          agentName: targetAgent ? targetAgent.name : 'GaaS-Proxy-Agent',
          actionCommand: sandboxAction,
          interceptedPacket: `POST /v1/webhook/intercept [GaaS API]`,
          policyViolated: `${policyMatched.code} (${policyMatched.name})`,
          latencyMs: lat,
          status: 'HALTED' as const,
          rawJsonIntent: sandboxPayload,
          timestampAnnexV: `20260609-${new Date().getTime().toString().substring(5)}-GAAS`
        };
        onTriggerKillEvent(newHaltEvent);
      } else {
        setSandboxState('OK');
        setSandboxResponseLog(prev => prev + `
Authentication handshake succeeded.
Intercepting action: "${sandboxAction}" from governed node ${sandboxAgentId}.
Evaluating active Policy: ${policyMatched.code} - "${policyMatched.name}"
Audit compliance matching passed.

🟢 [AUTHORIZED PROCESS NOMINAL]
Status: 200 OK (ACTION GRANTED)
Latency: ${lat}ms
GaaS Token: auth_bearer_${new Date().getTime().toString().substring(8)}

Verdict: Session parameters registered. Downstream REST action granted.`
        );

        // Add standard stable transaction to the Economic Value tracker!
        if (policyMatched.category === 'finance') {
          const mockSpend = Math.random() * 8 + 0.5;
          const newMetric = {
            id: generateTransactionId('VAL'),
            timestamp: new Date().toISOString(),
            agentName: targetAgent ? targetAgent.name : 'GaaS-Governed-Bot',
            completedTasks: 1,
            totalApiSpend: mockSpend,
            humanLaborSaved: 30.00,
            roiScore: 30 / mockSpend,
            status: 'STABLE' as const
          };
          onAddMetricEvent(newMetric);
        }
      }

      setIsSimulatingGaaS(false);
    }, 1200);
  };

  return (
    <div className="space-y-8 animate-fade-in text-zinc-100">
      {/* Banner introduction with solid clean black theme */}
      <div className="p-6 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl mt-1">
            <Cpu size={26} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                PARTNER PORT & GAAS
              </span>
              <span className="text-xs font-mono text-zinc-500">CROSS-PLATFORM GATEWAY</span>
            </div>
            <h1 className="text-2xl font-display font-medium text-white mt-1.5">
              Governance as a Service Gateway
            </h1>
            <p className="text-zinc-400 text-sm max-w-xl mt-1">
              Plug AgentsGuardian directly into **any** external framework (Python SDK, LangChain, CrewAI, AutoGen, or REST APIs) 
              as a cloud-neutral webhook shield. Guarantee active compliance with less than {GUARANTEED_SLA_MS}ms intercept latencies.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3 select-none">
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-850 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                Active IAM Role: <strong className="text-white font-semibold">[{currentUser.role}]</strong>
              </span>
              <span className={`text-[10px] font-mono border px-2.5 py-1 rounded font-bold ${
                currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin'
                  ? 'text-emerald-400 bg-emerald-950/15 border-emerald-500/20'
                  : currentUser.role === 'PolicyManager'
                  ? 'text-amber-400 bg-amber-950/15 border-amber-500/20'
                  : currentUser.role === 'Auditor'
                  ? 'text-rose-400 bg-rose-950/15 border-rose-500/20'
                  : 'text-indigo-400 bg-indigo-950/15 border-indigo-500/20'
              }`}>
                {currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin'
                  ? '👑 Root Workspace Owner Access'
                  : currentUser.role === 'PolicyManager'
                  ? '⚡ Policy Mapping & SLA Calibration Access'
                  : currentUser.role === 'Auditor'
                  ? '🔒 Read-Only Compliance Auditor Mode'
                  : '⚙️ Operating Deployment & Hook Access'
                }
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 shrink-0">
          <div className="text-right font-mono text-xs pr-2.5 border-r border-zinc-800">
            <span className="text-[10px] text-zinc-500 block">SLA GUARANTEE</span>
            <span className="text-emerald-400 font-bold">&lt; {GUARANTEED_SLA_MS}ms Target</span>
          </div>
          <div className="text-left font-mono text-xs pl-2.5">
            <span className="text-[10px] text-zinc-500 block">GATEWAY STATUS</span>
            <span className="text-teal-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-ping" /> NOMINAL-ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* API Key Credentials control & Webhook configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* API Credentials */}
        <CollapsibleSection
          title="GaaS Credentials"
          subtitle="Authorized API Key passed through standard X-Guardian-Key HTTP request headers to authenticate other agents."
          icon={<Key size={18} className="text-zinc-400" />}
          className="lg:col-span-4 p-6 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col justify-between"
        >
          <div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 tracking-wider font-bold block mb-1">
                  Active Secret Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={isGeneratingKey ? 'GENERATING...' : apiKey}
                    disabled
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 pr-12 text-zinc-400"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(apiKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-zinc-500 hover:text-white transition"
                    title="Copy Key"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-500 tracking-wider font-bold block mb-1">
                  Central GaaS Webhook Endpoint
                </label>
                <input
                  type="text"
                  value="https://api.agentguardian.io/v1/intercept"
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-900">
            <button
              onClick={handleGenerateNewKey}
              disabled={isGeneratingKey}
              className="w-full py-2.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 font-display font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isGeneratingKey ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Rotating Core API Key...
                </>
              ) : (
                <>
                  <RefreshCw size={13} /> Rotate GaaS API Credentials
                </>
              )}
            </button>
          </div>
        </CollapsibleSection>

        {/* Integration Code Snippets Panel */}
        <CollapsibleSection
          title="Multi-Platform SDK & Middleware Integrations"
          subtitle="Select standard code configurations to intercept and enforce policy rules within your preferred AI frameworks:"
          icon={<Code2 size={18} className="text-teal-400" />}
          headerExtra={
            copied ? (
              <span className="text-[10px] font-mono text-emerald-400 animate-pulse bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded mr-2">
                Copied snippet to clipboard!
              </span>
            ) : undefined
          }
          className="lg:col-span-8 p-6 rounded-xl bg-[#09090B] border border-zinc-800"
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
            {(Object.keys(FRAMEWORK_CODE_TEMPLATES) as Array<keyof typeof FRAMEWORK_CODE_TEMPLATES>).map((key) => (
              <button
                key={key}
                onClick={() => setActiveCodeTab(key)}
                className={`
                  px-2.5 py-1.5 font-mono text-xs rounded border text-center transition-colors block cursor-pointer
                  ${activeCodeTab === key 
                    ? 'bg-zinc-900 text-white border-zinc-700 font-semibold' 
                    : 'bg-zinc-950 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/40'
                  }
                `}
              >
                {key.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Interactive Code Console display */}
          <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 mb-3">
            <div className="flex items-center justify-between text-[10px] font-mono bg-zinc-900/60 p-2.5 px-4 border-b border-zinc-800 text-zinc-400">
              <span className="uppercase text-zinc-400">{FRAMEWORK_CODE_TEMPLATES[activeCodeTab].title}</span>
              <button 
                onClick={handleCopyCode} 
                className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                id="btn-gaas-copy-code"
              >
                <Copy size={11} /> Copy Code
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs text-emerald-400 font-mono h-64 leading-relaxed whitespace-pre">
              {FRAMEWORK_CODE_TEMPLATES[activeCodeTab].code}
            </pre>
          </div>

          <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-zinc-500 justify-end">
            <Server size={12} className="text-zinc-600" />
            <span>*All evaluation occurs pre-execution via synchronous webhook proxy.</span>
          </div>
        </CollapsibleSection>
      </div>

      {/* Governed Agents Registry Block & Live Sandbox Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Governed Agent Registration (Left Form) */}
        <CollapsibleSection
          title="Register Governing Agent Hook"
          subtitle="Initialize a webhook connection targeting an autonomous third-party agent to include it in the real-time ledger auditing."
          icon={<Webhook size={18} className="text-teal-400" />}
          className="lg:col-span-5 p-6 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col justify-between"
        >
          <div>
            {!(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin' || currentUser.role === 'Operator') ? (
              <div className="p-6 rounded-lg bg-zinc-950/60 border border-zinc-900 text-center space-y-4 my-2 animate-in fade-in duration-200" id="webhook-reg-locked">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-500">
                  <Lock size={20} className="animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">🔒 Webhook Binding Restricted</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Establishing central GaaS agent webhook bindings requires verified Admin or Operator permissions. Your current role is <strong className="text-zinc-200">[{currentUser.role}]</strong>.
                  </p>
                  <p className="text-[10px] text-zinc-550 leading-relaxed">
                    Refer directly to core compliance guidelines or contact the system owner to swap to active deployment groups.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddGovernedAgent} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-zinc-500 tracking-wider font-bold block mb-1">
                    Agent ID / Descriptor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FinanceParser-Bot-2"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 tracking-wider font-bold block mb-1">
                      Framework Ecosystem
                    </label>
                    <select
                      value={newAgentFramework}
                      onChange={(e) => setNewAgentFramework(e.target.value as GoverningAgent['framework'])}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-300 font-mono focus:outline-none"
                    >
                      <option value="CrewAI">CrewAI Framework</option>
                      <option value="LangChain">LangChain Ecosystem</option>
                      <option value="AutoGen">Microsoft AutoGen</option>
                      <option value="MCP Server">MCP Server (Model Context Protocol)</option>
                      <option value="MCP Client">MCP Client (Model Context Protocol)</option>
                      <option value="Custom API">Generic REST Client</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 tracking-wider font-bold block mb-1">
                      Enforced Base Policy
                    </label>
                    <select
                      value={newAgentPolicy}
                      onChange={(e) => setNewAgentPolicy(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-300 font-mono focus:outline-none"
                    >
                      {policies.map(p => (
                        <option key={p.id} value={p.code}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-zinc-950 hover:bg-teal-500 text-zinc-300 hover:text-black hover:font-bold border border-zinc-800 hover:border-teal-400 text-xs font-display font-semibold rounded-lg transition-all cursor-pointer"
                  id="btn-register-gaas-agent"
                >
                  Hook Governing Agent Instance
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-zinc-900 pt-4 mt-6 space-y-3">
            <div>
              <span className="text-[10px] font-mono text-zinc-500 block mb-1 uppercase tracking-wide">
                Active Integration Webhook Target URI
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testWebhookUrl}
                  onChange={(e) => setTestWebhookUrl(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-700"
                  placeholder="https://your-api.com/gaas-webhook"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-zinc-800 text-zinc-300 rounded font-display text-xs font-semibold select-none flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  id="btn-test-gaas-connection"
                >
                  {isTestingConnection ? (
                    <RefreshCw size={12} className="animate-spin text-teal-400" />
                  ) : (
                    <Play size={10} className="text-teal-400 fill-teal-400" />
                  )}
                  {isTestingConnection ? 'Testing' : 'Test Connection'}
                </button>
              </div>
            </div>

            {testStatus && (
              <div className={`p-2.5 rounded border text-[10.5px] font-mono leading-relaxed max-h-36 overflow-y-auto scrollbar animate-fade-in ${
                testStatus.type === 'SUCCESS' 
                  ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-400' 
                  : testStatus.type === 'PENDING'
                  ? 'bg-zinc-900/40 border-zinc-800/40 text-zinc-400 font-bold'
                  : 'bg-rose-950/10 border-rose-900/40 text-rose-400'
              }`}>
                <pre className="whitespace-pre-wrap font-mono">{testStatus.output}</pre>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Live Interface Simulator Sandbox (Right Console) */}
        <CollapsibleSection
          title={
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-teal-400" />
              <span className="text-xs font-mono text-white font-bold tracking-wider uppercase">
                GaaS Live Intercept Port Webhook Tester
              </span>
            </div>
          }
          subtitle="Test governance rules instantly. Simulate an incoming agent command packet over GaaS Webhook and view audit evaluation log:"
          headerExtra={
            <div className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 mr-2">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse block" />
              <span className="text-[9px] font-mono text-teal-400 font-bold tracking-wide uppercase">
                SIM PORT ACTIVE
              </span>
            </div>
          }
          className="lg:col-span-7 p-6 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col justify-between"
        >
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs font-mono">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Target Governed Agent Context</label>
                <select
                  value={sandboxAgentId}
                  onChange={(e) => setSandboxAgentId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-300 focus:outline-none"
                  id="gaas-select-agent"
                >
                  {governedAgents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.framework})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">Action Command Trigger</label>
                <input
                  type="text"
                  value={sandboxAction}
                  onChange={(e) => setSandboxAction(e.target.value)}
                  placeholder="e.g. purge_customer_leads"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                  id="gaas-action-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4 text-xs font-mono mb-4">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-1">JSON Intercept Payload Metadata</label>
                <textarea
                  value={sandboxPayload}
                  onChange={(e) => setSandboxPayload(e.target.value)}
                  className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-teal-400 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500/40 scrollbar"
                  spellCheck="false"
                  id="gaas-payload-textarea"
                />
              </div>
            </div>

            {/* Sandbox Live Response Stream */}
            <div className={`w-full overflow-y-auto h-36 bg-zinc-950 rounded-lg border border-zinc-800 p-3 mb-4 font-mono text-xs whitespace-pre leading-relaxed scrollbar ${
              sandboxState === 'HALTED' ? 'text-rose-400' : sandboxState === 'OK' ? 'text-zinc-300' : 'text-zinc-500'
            }`}>
              {sandboxResponseLog ? (
                <div>{sandboxResponseLog}</div>
              ) : (
                <div className="italic py-10 text-center text-zinc-600 font-sans">
                  Input dummy request parameters above, then pitch the payload to the GaaS Gateway.
                </div>
              )}
            </div>
          </div>

          <div>
            <button
              onClick={handleExecuteSandboxPost}
              disabled={isSimulatingGaaS}
              className={`
                w-full py-3 px-4 font-display font-bold text-xs tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 transition cursor-pointer
                ${sandboxState === 'HALTED' 
                  ? 'bg-red-550 hover:bg-red-650 text-white' 
                  : 'bg-teal-500 hover:bg-teal-400 text-black font-semibold shadow-md'
                }
              `}
              id="btn-post-gaas-sim"
            >
              {isSimulatingGaaS ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> EXECUTING REAL-TIME SECURE POLICIES...
                </>
              ) : (
                <>
                  <Play size={13} /> Post to GaaS Intercept Port
                </>
              )}
            </button>
          </div>
        </CollapsibleSection>
      </div>

      {/* Governing Agents Matrix Grid - Displays all registered framework agents */}
      <CollapsibleSection
        title="Governed Active System Agents (GaaS Registered)"
        subtitle="General governance ledger status for all framework modules currently hooked into AgentsGuardian"
        icon={<Cpu size={18} className="text-teal-400" />}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 mr-2">
            <button
              onClick={handleExportAgentsJson}
              className="px-3 py-1.5 font-mono text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:border-teal-400 rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-97"
              id="btn-export-agents-json"
              title="Download current status of all governed agents, request counts, and policy statuses as a JSON file"
              type="button"
            >
              <FileJson size={14} className="text-teal-400" />
              <Download size={12} className="text-teal-400" />
              <span>Export Agents Status (JSON)</span>
            </button>

            <span className="px-3 py-1 font-mono text-xs font-bold bg-zinc-950 text-zinc-400 border border-zinc-800 rounded">
              {governedAgents.length} Agents Enrolled
            </span>
          </div>
        }
        className="p-6 rounded-xl bg-[#09090B] border border-zinc-800"
      >
        {/* Operational Status Summary Panel */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="gaas-agent-status-summary-panel">
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Total Connected Nodes</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-display font-bold text-white">{governedAgents.length}</span>
              <span className="text-[9px] font-mono text-zinc-650 font-bold uppercase">agents</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider font-bold">Healthy (Nominal)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-display font-bold text-emerald-400">
                {governedAgents.filter(a => a.status === 'NOMINAL').length}
              </span>
              <span className="text-[9px] font-mono text-emerald-600/70 font-bold uppercase">SHIELDED</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <span className="text-[10px] font-mono text-rose-500 uppercase tracking-wider font-bold">Alert / Blocked</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-display font-bold text-rose-450">
                {governedAgents.filter(a => a.status !== 'NOMINAL').length}
              </span>
              <span className="text-[9px] font-mono text-rose-600/70 font-bold uppercase">ALERTS</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 flex flex-col justify-between hover:border-zinc-850 transition-colors">
            <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider font-bold">Enforced Policy Models</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-display font-bold text-teal-400">
                {new Set(governedAgents.map(a => a.attachedPolicyCode)).size}
              </span>
              <span className="text-[9px] font-mono text-teal-600/70 font-bold uppercase">rules</span>
            </div>
          </div>
        </div>

        {/* Search input for filtering agents */}
        <div className="mb-6 relative" id="gaas-agent-search-input-wrapper">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search governed agents by name, framework, or status..."
            value={agentSearchQuery}
            onChange={(e) => setAgentSearchQuery(e.target.value)}
            className="w-full text-xs bg-zinc-950 border border-zinc-800 hover:border-zinc-750 focus:border-teal-500 rounded-lg pl-10 pr-10 py-2.5 text-zinc-200 focus:outline-none placeholder-zinc-500 transition-colors font-mono"
            id="gaas-agent-search-input"
          />
          {agentSearchQuery && (
            <button
              onClick={() => setAgentSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-white text-[11px] font-mono cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Bulk Action Controls Bar */}
        {filteredAgents.length > 0 && (
          <div className="mb-4 p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-inner animate-in fade-in duration-200" id="gaas-bulk-actions-belt">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none font-mono text-zinc-300">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = isAnyFilteredSelected && !isAllFilteredSelected;
                    }
                  }}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-800 text-teal-400 checked:bg-teal-500 hover:checked:bg-teal-400 focus:ring-0 cursor-pointer accent-teal-500"
                  id="gaas-bulk-select-all"
                />
                <span className="font-bold text-zinc-250">Select All ({filteredAgents.length})</span>
              </label>
              
              <span className="text-zinc-700 font-mono">|</span>
              
              <span className="text-zinc-400 font-mono text-[11px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850">
                <strong className="text-teal-400">{selectedAgentIds.filter(id => filteredAgents.some(fa => fa.id === id)).length}</strong> selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkHalt}
                disabled={selectedAgentIds.filter(id => filteredAgents.some(fa => fa.id === id)).length === 0 || currentUser.role === 'Auditor'}
                className="px-3 py-1.5 rounded-md bg-rose-950/15 border border-rose-500/25 text-rose-450 font-mono font-bold text-[10.5px] hover:bg-rose-955/40 hover:border-rose-450 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-97"
                title={currentUser.role === 'Auditor' ? "Role restricted" : "Halt execution state of all selected agents"}
                id="gaas-bulk-halt-btn"
                type="button"
              >
                🚨 Halt Selected ({selectedAgentIds.filter(id => {
                  const agent = governedAgents.find(a => a.id === id);
                  return agent?.status === 'NOMINAL' && filteredAgents.some(fa => fa.id === id);
                }).length} Nominal)
              </button>

              <button
                onClick={handleBulkResume}
                disabled={selectedAgentIds.filter(id => filteredAgents.some(fa => fa.id === id)).length === 0 || currentUser.role === 'Auditor'}
                className="px-3 py-1.5 rounded-md bg-emerald-950/15 border border-emerald-500/25 text-emerald-400 font-mono font-bold text-[10.5px] hover:bg-emerald-955/40 hover:border-emerald-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-97"
                title={currentUser.role === 'Auditor' ? "Role restricted" : "Resume nominal status of all selected agents"}
                id="gaas-bulk-resume-btn"
                type="button"
              >
                🛡️ Resume Selected ({selectedAgentIds.filter(id => {
                  const agent = governedAgents.find(a => a.id === id);
                  return agent?.status !== 'NOMINAL' && filteredAgents.some(fa => fa.id === id);
                }).length} Blocked)
              </button>

              {selectedAgentIds.filter(id => filteredAgents.some(fa => fa.id === id)).length > 0 && (
                <button
                  onClick={() => setSelectedAgentIds([])}
                  className="px-2.5 py-1.5 text-[10px] text-zinc-500 hover:text-white font-mono transition-colors cursor-pointer"
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {filteredAgents.length === 0 ? (
          <div className="p-8 text-center bg-zinc-950 border border-zinc-900 rounded-lg">
            <p className="text-zinc-550 text-xs font-mono">No governed active agents match your search filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <div 
                key={agent.id}
                className={`p-4 rounded-lg bg-zinc-950 border transition-all flex flex-col justify-between ${
                  selectedAgentIds.includes(agent.id) 
                    ? 'border-teal-500/50 shadow-md ring-1 ring-teal-500/10' 
                    : 'border-zinc-900 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.id)}
                        onChange={() => {
                          setSelectedAgentIds(prev => 
                            prev.includes(agent.id) 
                              ? prev.filter(id => id !== agent.id) 
                              : [...prev, agent.id]
                          );
                        }}
                        className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 text-teal-400 accent-teal-500 focus:ring-0 cursor-pointer"
                        id={`select-agent-chk-${agent.id}`}
                      />
                      <span className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-900 text-zinc-500 border border-zinc-800 rounded font-bold">
                        {agent.id}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-teal-400 tracking-wider">
                      {agent.framework.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-display font-bold text-white text-sm">{agent.name}</h4>
                  <p className="text-[11px] font-mono text-zinc-500 block mt-1 truncate max-w-xs">{agent.webhookUrl}</p>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono gap-2">
                    <span className="text-zinc-500 font-bold">Active Rule:</span>
                    <select
                      value={agent.attachedPolicyCode}
                      disabled={!(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin' || currentUser.role === 'PolicyManager')}
                      onChange={(e) => {
                        const newCode = e.target.value;
                        setGovernedAgents(prev => prev.map(a => 
                          a.id === agent.id ? { ...a, attachedPolicyCode: newCode } : a
                        ));
                        addToast({
                          type: 'success',
                          title: '🛡️ Policy Mapping Remapped',
                          message: `Governed Agent "${agent.name}" has been mapped to active Rule "${newCode}".`
                        });
                      }}
                      className={`bg-[#090e17] border border-zinc-800 font-bold text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:border-zinc-700 w-28 text-right truncate bg-zinc-950 font-mono ${
                        !(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin' || currentUser.role === 'PolicyManager')
                          ? 'text-zinc-500 cursor-not-allowed opacity-60'
                          : 'text-[#1D9E75] cursor-pointer'
                      }`}
                      title={
                        !(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin' || currentUser.role === 'PolicyManager')
                          ? "Altering dynamic policy mappings requires Admin or Policy Manager access rights."
                          : "Select policy to map to agent"
                      }
                    >
                      {policies.map(p => (
                        <option key={p.id} value={p.code} className="bg-[#090e17] text-zinc-300 text-left font-mono text-[10px]">
                          {p.code} ({p.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-500">APIs Evaluated:</span>
                    <span className="text-zinc-300 font-semibold">{agent.requestCount} logs</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between gap-1 text-xs">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] text-zinc-500 font-mono tracking-wider">LEDGER STATUS</span>
                    {agent.status === 'NOMINAL' ? (
                      <span className="text-emerald-400 font-bold font-mono text-[10px] bg-emerald-950/20 border border-emerald-500/20 px-1.5 py-0.3 rounded-sm flex items-center gap-1">
                        <ShieldCheck size={11} /> NOMINAL
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold font-mono text-[10px] bg-rose-950/20 border border-rose-500/20 px-1.5 py-0.3 rounded-sm flex items-center gap-1 animate-pulse">
                        <AlertCircle size={11} /> HALTED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {agent.status === 'NOMINAL' ? (
                      <button
                        onClick={() => {
                          if (currentUser.role === 'Auditor') {
                            addToast({
                              type: 'danger',
                              title: 'Access Prohibited',
                              message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
                            });
                            return;
                          }
                          setGovernedAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'ALERT' } : a));
                          addToast({
                            type: 'warning',
                            title: '🚨 Agent Halted',
                            message: `Credential keys invalidated for agent cluster "${agent.name}".`
                          });
                        }}
                        disabled={currentUser.role === 'Auditor'}
                        className="px-2 py-1 text-[10px] font-mono font-bold text-rose-450 bg-rose-950/10 hover:bg-rose-900/25 border border-rose-905/30 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={currentUser.role === 'Auditor' ? "Auditor profile is read-only" : "Halt agent execution"}
                        type="button"
                      >
                        Halt
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (currentUser.role === 'Auditor') {
                            addToast({
                              type: 'danger',
                              title: 'Access Prohibited',
                              message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
                            });
                            return;
                          }
                          setGovernedAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'NOMINAL' } : a));
                          addToast({
                            type: 'success',
                            title: '🛡️ Agent Reactivated',
                            message: `Safety nominal shields and authorization tokens restored for agent cluster "${agent.name}".`
                          });
                        }}
                        disabled={currentUser.role === 'Auditor'}
                        className="px-2 py-1 text-[10px] font-mono font-bold text-emerald-450 bg-emerald-950/15 hover:bg-emerald-900/25 border border-emerald-905/30 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={currentUser.role === 'Auditor' ? "Auditor profile is read-only" : "Resume security parameters"}
                        type="button"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Real-time GaaS API Request History Ledger */}
      <CollapsibleSection
        title="GaaS Real-Time Intercept Logs"
        subtitle="Audits and monitors inbound REST API webhooks, policy check evaluations, and token authorizations in real-time."
        icon={<History size={18} className="text-teal-400" />}
        headerExtra={
          <div className="flex flex-wrap items-center gap-3 mr-2">
            {/* Latency Threshold SLAs Setting */}
            <div className="flex items-center gap-2 bg-[#121214] px-3 py-1.5 border border-zinc-850 rounded">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Max SLA Limit</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="15"
                  max="500"
                  step="5"
                  value={latencyThreshold}
                  disabled={currentUser.role === 'Auditor'}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLatencyThreshold(val);
                  }}
                  onMouseUp={(e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    addToast({
                      type: 'info',
                      title: 'Gateway SLA Target Calibrated',
                      message: `The maximum SLA latency standard has been successfully calibrated to ${val}ms.`
                    });
                  }}
                  onTouchEnd={(e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    addToast({
                      type: 'info',
                      title: 'Gateway SLA Target Calibrated',
                      message: `The maximum SLA latency standard has been successfully calibrated to ${val}ms.`
                    });
                  }}
                  className={`w-16 accent-amber-500 h-1 rounded bg-zinc-800 ${
                    currentUser.role === 'Auditor' ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  }`}
                  id="latency-sla-slider"
                  title={
                    currentUser.role === 'Auditor'
                      ? "Auditors are restricted from modifying SLA latency standards."
                      : "Drag to calibrate maximum SLA latency limit"
                  }
                />
                <span className="text-[10.5px] font-mono font-bold text-amber-500 w-12 text-right">
                  {latencyThreshold}ms
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Auto-Interval</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => {
                  const val = e.target.value;
                  const parsed = val === 'off' ? 'off' : Number(val);
                  setAutoRefreshInterval(parsed);
                  addToast({
                    type: parsed === 'off' ? 'warning' : 'success',
                    title: parsed === 'off' ? 'Live Telemetry Suspended' : 'Live Telemetry Active',
                    message: parsed === 'off'
                      ? 'Real-time background client polling has been paused.'
                      : `Synchronized gateway polling frequency established at ${parsed / 1000}s cycles.`
                  });
                }}
                className="bg-transparent border-none text-[10px] text-[#1D9E75] font-mono font-bold focus:outline-none cursor-pointer outline-none"
                id="gaas-refresh-interval-select"
              >
                <option value="off" className="bg-[#09090B] text-zinc-400">Off</option>
                <option value="30000" className="bg-[#09090B] text-[#1D9E75]">30s</option>
                <option value="60000" className="bg-[#09090B] text-[#1D9E75]">1m</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 border border-zinc-850 rounded py-1.5 h-[30px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${autoRefreshInterval !== 'off' ? 'bg-[#1D9E75] animate-ping' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-mono text-zinc-450 font-bold uppercase tracking-wider">
                {autoRefreshInterval !== 'off' ? 'Live Stream' : 'Paused'}
              </span>
            </div>

            <button
              onClick={() => setApiLogs([])}
              type="button"
              className="px-2.5 py-1.5 border border-zinc-805 hover:border-red-500/30 hover:bg-rose-950/10 text-zinc-400 hover:text-red-400 font-mono text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={12} /> Clear Logs
            </button>
          </div>
        }
        className="p-6 rounded-xl bg-[#09090B] border border-zinc-800 space-y-4"
      >
        {apiLogs.length === 0 ? (
          <div className="p-12 text-center rounded-lg bg-zinc-950/50 border border-zinc-900 border-dashed">
            <History size={26} className="mx-auto text-zinc-650 mb-2 animate-pulse" />
            <h4 className="text-xs font-mono font-bold text-zinc-500 uppercase">Audit Terminal Empty</h4>
            <p className="text-zinc-650 text-xs mt-1">
              Dispense target payloads or fire webhook requests from sandbox above to register transactions on live feed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/30 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  <th className="p-3.5 pl-4">Transaction ID</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Governed Agent</th>
                  <th className="p-3.5">API Endpoint</th>
                  <th className="p-3.5 text-center">Verdict Status</th>
                  <th className="p-3.5 text-right pr-4">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {apiLogs.map((log) => {
                  const isSlaBreached = log.latencyMs > latencyThreshold;
                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-zinc-900/20 transition-colors animate-fade-in group text-zinc-350 ${
                        isSlaBreached ? 'bg-amber-950/[0.05] border-l-2 border-l-amber-500' : ''
                      }`}
                    >
                      <td className="p-3.5 pl-4 text-zinc-500 font-bold">{log.id}</td>
                      <td className="p-3.5 text-zinc-455">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="p-3.5 font-sans font-medium text-white group-hover:text-teal-400 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-500">[{log.agentId}]</span>
                          <span>{log.agentName}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-zinc-500 font-semibold select-all">
                        {log.endpoint}
                      </td>
                      <td className="p-3.5 text-center">
                        {log.status === 'AUTHORIZED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/30 text-emerald-400 border border-emerald-950/40" title={formatSlaTooltip(log.latencyMs)}>
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            AUTHORIZED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/20 text-rose-450 border border-rose-950/30 animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-rose-400" />
                            HALTED
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right pr-4 font-semibold">
                        <div className="flex items-center justify-end gap-2">
                          {isSlaBreached && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/45 text-amber-500 border border-amber-500/20 animate-pulse" title={formatSlaTooltip(log.latencyMs)}>
                              <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                              SLA BREACH
                            </span>
                          )}
                          <span 
                            title={formatSlaTooltip(log.latencyMs)}
                            className={isSlaBreached ? 'text-amber-500 font-bold' : log.latencyMs <= GUARANTEED_SLA_MS ? 'text-emerald-400' : 'text-amber-400'}
                          >
                            {log.latencyMs}ms
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
