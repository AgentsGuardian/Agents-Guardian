/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Terminal, Key, Webhook, Cpu, Code2, Play, Check, Copy, Sparkles, RefreshCw, Server, AlertCircle, ShieldCheck, Trash2, History, AlertTriangle, Search, Download, FileJson, Lock } from 'lucide-react';
import { Policy, GoverningAgent, ApiRequestLog, AdminUser } from '../types';
import { GUARANTEED_SLA_MS, formatSlaTooltip, formatTimestamp } from '../utils';
import CollapsibleSection from './CollapsibleSection';

interface GaaSApiPillarProps {
  policies: Policy[];
  onTriggerKillEvent: (event: any) => void;
  onAddMetricEvent: (metric: any) => void;
  governedAgents: GoverningAgent[];
  setGovernedAgents: React.Dispatch<React.SetStateAction<GaaSApiPillarAgent>>;
  onAddAgent?: (agent: Partial<GoverningAgent>) => Promise<void>;
  onUpdateAgent?: (id: string, updates: Partial<GoverningAgent>) => Promise<void>;
  onDeleteAgent?: (id: string) => Promise<void>;
  onBulkAgentStatus?: (ids: string[], status: 'NOMINAL' | 'ALERT' | 'HALTED') => Promise<void>;
  onRefreshState?: () => Promise<void>;
  apiLogs: ApiRequestLog[];
  setApiLogs: React.Dispatch<React.SetStateAction<ApiRequestLog[]>>;
  autoRefreshInterval: number | 'off';
  setAutoRefreshInterval: React.Dispatch<React.SetStateAction<number | 'off'>>;
  latencyThreshold: number;
  setLatencyThreshold: React.Dispatch<React.SetStateAction<number>>;
  addToast: (t: any) => void;
  currentUser: AdminUser;
}

type GaaSApiPillarAgent = GoverningAgent[];

const getFrameworkCodeTemplates = (activeKey: string) => {
  const displayKey = activeKey || '<ACTIVE_GAAS_SECRET_KEY>';
  const gatewayUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1/intercept` : '/api/v1/intercept';
  return {
    python: {
      title: 'Python GaaS SDK',
      lang: 'python',
      code: `from guardian_sdk import AgentsGuardian, PolicyContext

# Initialize Governance as a Service interceptor
guardian = AgentsGuardian(
    api_key="${displayKey}",
    gateway_url="${gatewayUrl}"
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
        "${gatewayUrl}",
        headers={"X-Guardian-Key": "${displayKey}"},
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

# Define a customized CrewAI agent wrapped by Governance-as-a-Service gateway
class GovernedAgent(Agent):
    def execute_task(self, task, context=None, tools=None):
        # Fire intercept telemetry to GaaS Gateway prior to task execution
        gaas_res = requests.post(
            "${gatewayUrl}",
            headers={"X-Guardian-Key": "${displayKey}"},
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
        "${gatewayUrl}",
        headers={"X-Guardian-Key": "${displayKey}"},
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
  const gaasRes = await fetch("${gatewayUrl}", {
    method: "POST",
    headers: {
      "X-Guardian-Key": "${displayKey}",
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

  // Execute target MCP Tool if policy checks pass
  return await executeTargetMcpTool(name, toolArgs);
});`
    },
    curl: {
      title: 'Direct REST API (cURL)',
      lang: 'bash',
      code: `curl -X POST "${gatewayUrl}" \\
  -H "X-Guardian-Key: ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "MAIL-GOOGLE-SCRIPT",
    "action": "delete_customer_leads",
    "parameters": {
      "table": "purchases_2026",
      "records_count": 845
    }
  }'`
    }
  };
};

export default function GaaSApiPillar({ 
  policies, 
  governedAgents,
  onAddAgent,
  onUpdateAgent,
  onDeleteAgent,
  onBulkAgentStatus,
  onRefreshState,
  apiLogs,
  autoRefreshInterval,
  setAutoRefreshInterval,
  latencyThreshold,
  setLatencyThreshold,
  addToast,
  currentUser
}: GaaSApiPillarProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'langchain' | 'crewai' | 'autogen' | 'mcp' | 'curl'>('python');
  const [agentSearchQuery, setAgentSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [logsClearedBeforeMs, setLogsClearedBeforeMs] = useState<number | null>(null);
  const seenLogIdsRef = useRef<Set<string> | null>(null);

  const frameworkCodeTemplates = useMemo(() => getFrameworkCodeTemplates(apiKey), [apiKey]);

  const sortedApiLogs = useMemo(() => {
    return [...apiLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [apiLogs]);

  const visibleApiLogs = useMemo(() => {
    if (logsClearedBeforeMs === null) return sortedApiLogs;
    return sortedApiLogs.filter(log => new Date(log.timestamp).getTime() > logsClearedBeforeMs);
  }, [sortedApiLogs, logsClearedBeforeMs]);

  const realAgentLogCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of governedAgents) {
      const aId = agent.id.trim().toLowerCase();
      const aName = (agent.name || '').trim().toLowerCase();
      const count = sortedApiLogs.filter(l => {
        const lId = (l.agentId || '').trim().toLowerCase();
        const lName = (l.agentName || '').trim().toLowerCase();
        return lId === aId || (aName && (lName === aName || lId === aName));
      }).length;
      counts.set(agent.id, count);
    }
    return counts;
  }, [governedAgents, sortedApiLogs]);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveKey = async () => {
      try {
        const sessionToken = sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token');
        const res = await fetch('/api/gaas/credentials', {
          cache: 'no-store',
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data && data.activeKey && isMounted) {
          setApiKey(data.activeKey);
        }
      } catch (err: any) {
        console.warn('Could not retrieve active GaaS key from server:', err?.message || err);
      }
    };
    fetchActiveKey();
    return () => { isMounted = false; };
  }, []);

  // Poll live server state at configured autoRefreshInterval
  useEffect(() => {
    if (autoRefreshInterval === 'off' || !onRefreshState) return;
    const timer = setInterval(() => {
      onRefreshState().catch(() => {});
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, onRefreshState]);

  // Fire SLA warning toast ONLY for real newly arriving requests whose server latency exceeds latencyThreshold
  useEffect(() => {
    if (seenLogIdsRef.current === null) {
      seenLogIdsRef.current = new Set(sortedApiLogs.map(l => l.id));
      return;
    }
    for (const log of sortedApiLogs) {
      if (!seenLogIdsRef.current.has(log.id)) {
        seenLogIdsRef.current.add(log.id);
        if (log.latencyMs > latencyThreshold) {
          addToast({
            type: 'warning',
            title: '⚠️ SLA Latency Limit Breached',
            message: `Intercept request for ${log.agentName || log.agentId} responded in ${log.latencyMs}ms (Max SLA Limit: ${latencyThreshold}ms).`,
            duration: 5000
          });
        }
      }
    }
  }, [sortedApiLogs, latencyThreshold, addToast]);

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
        totalEvaluatedRequests: governedAgents.reduce((sum, a) => sum + (realAgentLogCounts.get(a.id) ?? a.requestCount), 0)
      },
      governedAgents: governedAgents.map(agent => {
        const policyMatched = policies.find(p => p.code === agent.attachedPolicyCode);
        return {
          id: agent.id,
          name: agent.name,
          framework: agent.framework,
          status: agent.status,
          requestCount: realAgentLogCounts.get(agent.id) ?? agent.requestCount,
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

  const handleBulkHalt = async () => {
    if (currentUser.role === 'Auditor') {
      addToast({
        type: 'danger',
        title: 'Access Prohibited',
        message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
      });
      return;
    }
    if (selectedAgentIds.length === 0) return;

    try {
      if (onBulkAgentStatus) {
        await onBulkAgentStatus(selectedAgentIds, 'HALTED');
      }
      addToast({
        type: 'warning',
        title: '🚨 Bulk Halts Initiated',
        message: `Successfully halted and revoked credentials of ${selectedAgentIds.length} governed agent node(s).`
      });
      setSelectedAgentIds([]);
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: '❌ Bulk Halt Failed',
        message: err?.message || 'Failed to halt selected agents on server.'
      });
    }
  };

  const handleBulkResume = async () => {
    if (currentUser.role === 'Auditor') {
      addToast({
        type: 'danger',
        title: 'Access Prohibited',
        message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
      });
      return;
    }
    if (selectedAgentIds.length === 0) return;

    try {
      if (onBulkAgentStatus) {
        await onBulkAgentStatus(selectedAgentIds, 'NOMINAL');
      }
      addToast({
        type: 'success',
        title: '🛡️ Bulk Resume Completed',
        message: `Successfully restored safety clearance and nominal shields for ${selectedAgentIds.length} governed agent node(s).`
      });
      setSelectedAgentIds([]);
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: '❌ Bulk Resume Failed',
        message: err?.message || 'Failed to resume selected agents on server.'
      });
    }
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
  const [newAgentPolicy, setNewAgentPolicy] = useState<string>('');

  useEffect(() => {
    if (policies.length > 0 && (!newAgentPolicy || !policies.some(p => p.code === newAgentPolicy))) {
      setNewAgentPolicy(policies[0].code);
    }
  }, [policies, newAgentPolicy]);

  // Interactive Live Intercept Sandbox
  const [sandboxAgentId, setSandboxAgentId] = useState<string>('');
  const [sandboxAction, setSandboxAction] = useState<string>('Database Purge /v1/delete');
  const [sandboxPayload, setSandboxPayload] = useState<string>(`{\n  "records": "all_inactive_leads_2025",\n  "table": "customer_database",\n  "force": true,\n  "initiated_by_platform": "CrewAI-Dev-Node"\n}`);
  const [isSimulatingGaaS, setIsSimulatingGaaS] = useState<boolean>(false);
  const [sandboxResponseLog, setSandboxResponseLog] = useState<string>('');
  const [sandboxState, setSandboxState] = useState<'IDLE' | 'SENDING' | 'HALTED' | 'OK'>('IDLE');

  useEffect(() => {
    if (governedAgents.length > 0 && (!sandboxAgentId || !governedAgents.some(a => a.id === sandboxAgentId))) {
      setSandboxAgentId(governedAgents[0].id);
    } else if (governedAgents.length === 0 && sandboxAgentId) {
      setSandboxAgentId('');
    }
  }, [governedAgents, sandboxAgentId]);

  // Connection testing states
  const [testWebhookUrl, setTestWebhookUrl] = useState<string>('');
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{ type: 'PENDING' | 'SUCCESS' | 'ERROR'; output: string } | null>(null);

  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    const targetUrl = testWebhookUrl.trim();
    if (!targetUrl) {
      setTestStatus({
        type: 'ERROR',
        output: '[ERROR] Active Integration Webhook Target URI is empty. Enter a valid http:// or https:// endpoint URL.'
      });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Only http:// and https:// URLs are supported');
      }
    } catch (urlErr: any) {
      setTestStatus({
        type: 'ERROR',
        output: `[ERROR] Invalid Webhook URI "${targetUrl}": ${urlErr?.message || 'Malformed URL'}`
      });
      return;
    }

    setIsTestingConnection(true);
    setTestStatus({
      type: 'PENDING',
      output: `[HTTP] Dispatching POST probe to ${parsedUrl.toString()}...`
    });

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 6000);
    const startTime = performance.now();

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GaaS-Ping': 'true'
        },
        body: JSON.stringify({
          event: 'GAAS_INTEGRATION_TEST',
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timerId);
      const measuredLatencyMs = Math.max(1, Math.round(performance.now() - startTime));
      const bodyPreview = await response.text().catch(() => '');
      const truncatedPreview = bodyPreview.trim().slice(0, 220);

      if (response.ok) {
        setTestStatus({
          type: 'SUCCESS',
          output: `[HTTP] POST ${parsedUrl.toString()}\n[STATUS] ${response.status} ${response.statusText || 'OK'}\n[LATENCY] ${measuredLatencyMs}ms${truncatedPreview ? `\n[BODY] ${truncatedPreview}` : ''}\n[RESULT] Connection verified! Integration active.`
        });
      } else {
        setTestStatus({
          type: 'ERROR',
          output: `[HTTP] POST ${parsedUrl.toString()}\n[STATUS] ${response.status} ${response.statusText || 'Error'}\n[LATENCY] ${measuredLatencyMs}ms${truncatedPreview ? `\n[BODY] ${truncatedPreview}` : ''}\n[RESULT] Endpoint responded with non-2xx HTTP status ${response.status}.`
        });
      }
    } catch (err: any) {
      clearTimeout(timerId);
      const measuredLatencyMs = Math.max(1, Math.round(performance.now() - startTime));
      const errDetail = err?.name === 'AbortError'
        ? 'Request timed out after 6000ms'
        : (err?.message || 'Network or CORS connection failure');

      setTestStatus({
        type: 'ERROR',
        output: `[HTTP] POST ${parsedUrl.toString()} failed\n[LATENCY] ${measuredLatencyMs}ms\n[ERROR] ${errDetail}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(frameworkCodeTemplates[activeCodeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewKey = async () => {
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin') {
      addToast({
        type: 'danger',
        title: '🔒 Access Denied: Rotation Restricted',
        message: `Your active role [${currentUser.role}] is restricted from regenerating central GaaS Tenant Access Keys. Elevated Admin or SuperAdmin authorization is required.`
      });
      return;
    }
    setIsGeneratingKey(true);
    try {
      const sessionToken = sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token');
      const res = await fetch('/api/gaas/rotate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({ tenantId: 'tenant_default' })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Rotation failed with HTTP status ${res.status}`);
      }

      if (!data.rawKey) {
        throw new Error('Server did not return a rotated key');
      }

      setApiKey(data.rawKey);
      addToast({
        type: 'success',
        title: '🔑 Central GaaS Key Rotated',
        message: 'A brand-new GaaS Tenant Access Key was generated on the server, replaced the previous key, and its SHA-256 hash is active across all intercept gateways.'
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: '❌ Key Rotation Failed',
        message: err?.message || 'Failed to rotate GaaS API credentials on server.'
      });
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleAddGovernedAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin' && currentUser.role !== 'Operator') {
      addToast({
        type: 'danger',
        title: '🔒 Access Denied: Hook Registration Blocked',
        message: `Your active role [${currentUser.role}] is restricted from registering new GaaS agent hook endpoints. Requires Admin or Operator clearance.`
      });
      return;
    }
    const cleanName = newAgentName.trim();
    if (!cleanName) return;

    const canonicalId = cleanName.replace(/[/?#]+/g, '-');
    const newAgent: GoverningAgent = {
      id: canonicalId,
      name: cleanName,
      framework: newAgentFramework,
      webhookUrl: testWebhookUrl.trim(),
      attachedPolicyCode: newAgentPolicy || policies[0]?.code || 'POL-SEC-10',
      status: 'NOMINAL',
      requestCount: 0
    };

    try {
      if (onAddAgent) {
        await onAddAgent(newAgent);
      }
      setNewAgentName('');
      setSandboxAgentId(canonicalId);
      addToast({
        type: 'success',
        title: '🔌 Governing Agent Hooked',
        message: `Successfully registered agent "${cleanName}" (${canonicalId}) with rule ${newAgent.attachedPolicyCode}.`
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: '❌ Agent Registration Failed',
        message: err?.message || 'Server rejected governing agent registration.'
      });
    }
  };

  const handleExecuteSandboxPost = async () => {
    if (isSimulatingGaaS) return;
    if (!apiKey) {
      addToast({
        type: 'danger',
        title: '🔑 Active Key Unavailable',
        message: 'Cannot post to /api/v1/intercept because the active GaaS secret key has not loaded from the server.'
      });
      return;
    }

    setIsSimulatingGaaS(true);
    setSandboxState('SENDING');
    setSandboxResponseLog('Posting request to /api/v1/intercept with active X-Guardian-Key...');

    const targetAgent = governedAgents.find(a => a.id === sandboxAgentId);
    let parsedParams: any = sandboxPayload;
    const trimmedPayload = sandboxPayload.trim();
    if (trimmedPayload.startsWith('{') || trimmedPayload.startsWith('[')) {
      try {
        parsedParams = JSON.parse(trimmedPayload);
      } catch {
        parsedParams = sandboxPayload;
      }
    }

    const requestStart = performance.now();
    try {
      const res = await fetch('/api/v1/intercept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guardian-Key': apiKey
        },
        body: JSON.stringify({
          agent_id: targetAgent?.id || sandboxAgentId || undefined,
          agent_name: targetAgent?.name || undefined,
          action: sandboxAction.trim() || 'standard_action',
          endpoint: '/v1/intercept',
          parameters: parsedParams,
          prompt_text: sandboxAction.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      const clientElapsedMs = Math.max(1, Math.round(performance.now() - requestStart));

      if (!res.ok) {
        setSandboxState('HALTED');
        setSandboxResponseLog(
          `HTTP Status: ${res.status} ${res.statusText || ''}\n` +
          `Error: ${data?.error || data?.reason || 'Request rejected by GaaS gateway.'}\n` +
          `Round-trip Latency: ${clientElapsedMs}ms`
        );
        return;
      }

      const isBlocked = !data.authorized || data.status === 'HALTED' || data.decision === 'REJECTED';
      setSandboxState(isBlocked ? 'HALTED' : 'OK');

      const serverLatency = typeof data.latency_ms === 'number' ? data.latency_ms : clientElapsedMs;
      const policyDisplay = data.policy_code
        ? `${data.policy_code}${data.policy_violated ? ` (${data.policy_violated})` : ''}`
        : (data.policy_violated || 'NONE');

      setSandboxResponseLog(
        `Status: ${data.status || (isBlocked ? 'HALTED' : 'AUTHORIZED')} (HTTP ${res.status} / Decision: ${data.decision || (isBlocked ? 'REJECTED' : 'ALLOWED')})\n` +
        `Agent: ${data.agent_id || targetAgent?.id || 'N/A'}\n` +
        `Policy: ${policyDisplay}\n` +
        `Reason: ${data.reason || (isBlocked ? 'Action blocked by gateway policy.' : 'Allowed by gateway policy.')}\n` +
        `Ledger Hash: ${data.ledger_hash || 'N/A'}\n` +
        `Latency: ${serverLatency}ms`
      );

      if (onRefreshState) {
        await onRefreshState();
      }
    } catch (err: any) {
      setSandboxState('HALTED');
      setSandboxResponseLog(`Network error posting to /api/v1/intercept: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSimulatingGaaS(false);
    }
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
                  value={typeof window !== 'undefined' ? `${window.location.origin}/api/v1/intercept` : '/api/v1/intercept'}
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
            {(Object.keys(frameworkCodeTemplates) as Array<'python' | 'langchain' | 'crewai' | 'autogen' | 'mcp' | 'curl'>).map((key) => (
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
              <span className="uppercase text-zinc-400">{frameworkCodeTemplates[activeCodeTab].title}</span>
              <button 
                onClick={handleCopyCode} 
                className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                id="btn-gaas-copy-code"
              >
                <Copy size={11} /> Copy Code
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs text-emerald-400 font-mono h-64 leading-relaxed whitespace-pre">
              {frameworkCodeTemplates[activeCodeTab].code}
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
                      onChange={async (e) => {
                        const newCode = e.target.value;
                        try {
                          if (onUpdateAgent) {
                            await onUpdateAgent(agent.id, { attachedPolicyCode: newCode });
                          }
                          addToast({
                            type: 'success',
                            title: '🛡️ Policy Mapping Remapped',
                            message: `Governed Agent "${agent.name}" has been mapped to active Rule "${newCode}".`
                          });
                        } catch (err: any) {
                          addToast({
                            type: 'danger',
                            title: '❌ Policy Mapping Failed',
                            message: err?.message || 'Failed to update agent policy on server.'
                          });
                        }
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
                    <span className="text-zinc-300 font-semibold">{realAgentLogCounts.get(agent.id) ?? agent.requestCount} logs</span>
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
                        onClick={async () => {
                          if (currentUser.role === 'Auditor') {
                            addToast({
                              type: 'danger',
                              title: 'Access Prohibited',
                              message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
                            });
                            return;
                          }
                          try {
                            if (onUpdateAgent) {
                              await onUpdateAgent(agent.id, { status: 'HALTED' });
                            }
                            addToast({
                              type: 'warning',
                              title: '🚨 Agent Halted',
                              message: `Credential keys invalidated for agent cluster "${agent.name}".`
                            });
                          } catch (err: any) {
                            addToast({
                              type: 'danger',
                              title: '❌ Halt Failed',
                              message: err?.message || 'Failed to halt agent on server.'
                            });
                          }
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
                        onClick={async () => {
                          if (currentUser.role === 'Auditor') {
                            addToast({
                              type: 'danger',
                              title: 'Access Prohibited',
                              message: 'Read-only Auditor accounts are restricted from altering agent execution states.'
                            });
                            return;
                          }
                          try {
                            if (onUpdateAgent) {
                              await onUpdateAgent(agent.id, { status: 'NOMINAL' });
                            }
                            addToast({
                              type: 'success',
                              title: '🛡️ Agent Reactivated',
                              message: `Safety nominal shields and authorization tokens restored for agent cluster "${agent.name}".`
                            });
                          } catch (err: any) {
                            addToast({
                              type: 'danger',
                              title: '❌ Resume Failed',
                              message: err?.message || 'Failed to resume agent on server.'
                            });
                          }
                        }}
                        disabled={currentUser.role === 'Auditor'}
                        className="px-2 py-1 text-[10px] font-mono font-bold text-emerald-450 bg-emerald-950/15 hover:bg-emerald-900/25 border border-emerald-905/30 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={currentUser.role === 'Auditor' ? "Auditor profile is read-only" : "Resume security parameters"}
                        type="button"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (currentUser.role === 'Auditor') {
                          addToast({
                            type: 'danger',
                            title: 'Access Prohibited',
                            message: 'Read-only Auditor accounts are restricted from altering agent configurations.'
                          });
                          return;
                        }
                        if (window.confirm(`Are you sure you want to unhook and remove agent "${agent.name}"?`)) {
                          try {
                            if (onDeleteAgent) {
                              await onDeleteAgent(agent.id);
                            }
                            addToast({
                              type: 'danger',
                              title: '🔌 Agent Unhooked',
                              message: `Governed Agent "${agent.name}" has been permanently unhooked and removed.`
                            });
                          } catch (err: any) {
                            addToast({
                              type: 'danger',
                              title: '❌ Delete Failed',
                              message: err?.message || 'Failed to delete agent on server.'
                            });
                          }
                        }
                      }}
                      disabled={currentUser.role === 'Auditor'}
                      className="px-2 py-1 text-[10px] font-mono font-bold text-zinc-400 hover:text-rose-400 bg-zinc-900/60 hover:bg-rose-950/20 border border-zinc-800 hover:border-rose-800/40 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ml-1"
                      title={currentUser.role === 'Auditor' ? "Auditor profile is read-only" : "Unhook and remove agent"}
                      type="button"
                    >
                      Delete
                    </button>
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
              onClick={() => setLogsClearedBeforeMs(Date.now())}
              type="button"
              className="px-2.5 py-1.5 border border-zinc-805 hover:border-red-500/30 hover:bg-rose-950/10 text-zinc-400 hover:text-red-400 font-mono text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={12} /> Clear Logs
            </button>
          </div>
        }
        className="p-6 rounded-xl bg-[#09090B] border border-zinc-800 space-y-4"
      >
        {visibleApiLogs.length === 0 ? (
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
                {visibleApiLogs.map((log) => {
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
