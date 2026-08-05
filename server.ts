import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

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
export OPENAI_BASE_URL="https://api.agentguardian.io/v1/proxy"
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
