/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Plus, Shield, Activity, Coins, ToggleLeft, ToggleRight, Trash2, CheckCircle2, Search, UploadCloud, Scale, FileText, Check, Loader2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Policy, PolicyCategory } from '../types';
import { generateTransactionId } from '../utils';
import ConfirmationModal from './ConfirmationModal';

interface PolicyConfigProps {
  policies: Policy[];
  onTogglePolicy: (id: string) => void;
  onAddPolicy: (newPolicy: Policy) => void;
  onDeletePolicy: (id: string) => void;
}

export default function PolicyConfig({ policies, onTogglePolicy, onAddPolicy, onDeletePolicy }: PolicyConfigProps) {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('POL-SEC-03');
  const [newName, setNewName] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newCat, setNewCat] = useState<PolicyCategory>('security');
  const [newRadius, setNewRadius] = useState<string>('Sandbox Container');
  const [newThreshold, setNewThreshold] = useState<string>('Enforce instantly');
  const [success, setSuccess] = useState<boolean>(false);

  // Inline form errors
  const [formError, setFormError] = useState<{ name?: string; desc?: string } | null>(null);

  // Delete modal states
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [lawToRemove, setLawToRemove] = useState<string | null>(null);

  // Legal compliance parser states
  const [showLawParser, setShowLawParser] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [generatedPolicies, setGeneratedPolicies] = useState<Policy[] | null>(null);
  const [hasApplied, setHasApplied] = useState<boolean>(false);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all', 'enabled', 'disabled'

  // Counters
  const secCount = policies.filter(p => p.category === 'security').length;
  const ethCount = policies.filter(p => p.category === 'ethics').length;
  const finCount = policies.filter(p => p.category === 'finance').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; desc?: string } = {};

    if (!newName.trim()) {
      errors.name = 'Policy Name is required';
    }
    if (!newDesc.trim()) {
      errors.desc = 'Description / Constraint Logic rules are required';
    }

    if (Object.keys(errors).length > 0) {
      setFormError(errors);
      return;
    }

    setFormError(null);

    const newObj: Policy = {
      id: newCode,
      code: newCode,
      name: newName,
      description: newDesc,
      category: newCat,
      blastRadius: newRadius || 'Sandbox Container',
      threshold: newThreshold || 'Enforce instantly',
      enabled: true
    };

    onAddPolicy(newObj);
    
    // Reset form
    setNewName('');
    setNewDesc('');
    setNewCode(`POL-${newCat === 'security' ? 'SEC' : newCat === 'ethics' ? 'ETH' : 'FIN'}-${Date.now().toString().slice(-4)}`);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
    setShowAddForm(false);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as PolicyCategory;
    setNewCat(cat);
    const prefix = cat === 'security' ? 'SEC' : cat === 'ethics' ? 'ETH' : 'FIN';
    setNewCode(`POL-${prefix}-${Date.now().toString().slice(-4)}`);
  };

  // Compliance compilation & parsing logic
  const getLocalFallbackPolicies = (filename: string, preset?: string): Policy[] => {
    const act = (preset || filename || "custom").toLowerCase();
    if (act.includes("eu") || act.includes("europe") || act.includes("article")) {
      return [
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
    } else if (act.includes("executive") || act.includes("federal") || act.includes("us") || act.includes("2025")) {
      return [
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
      return [
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
      return [
        {
          id: "POL-CO-01",
          code: "POL-SEC-CO",
          name: "Deployer Risk Tracking (CO SB 24-205 • Delayed to June 2026)",
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
      return [
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
      const normalizedAct = (filename || preset || "Custom Compliance Directive").replace(/[_-]/g, ' ');
      return [
        {
          id: generateTransactionId('POL-GEN-SEC'),
          code: "POL-SEC-GEN",
          name: `Secure Shield Alignment: ${normalizedAct}`,
          description: `Outbound gateway intercepts and filters unauthorized system executions to protect local infrastructure under the guidelines of ${normalizedAct}.`,
          category: "security",
          blastRadius: "Global Gateway",
          threshold: "Halt instantly",
          enabled: true
        },
        {
          id: generateTransactionId('POL-GEN-ETH'),
          code: "POL-ETH-GEN",
          name: `Ethical Compliance Sentinel: ${normalizedAct}`,
          description: `Active sentinel continuously evaluates model response alignments and cognitive drift levels to satisfy compliance audits for ${normalizedAct}.`,
          category: "ethics",
          blastRadius: "Agent Container",
          threshold: "Warn on deviation",
          enabled: true
        },
        {
          id: generateTransactionId('POL-GEN-FIN'),
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
  };

  const startAnalysisAnimation = async (name: string, content?: string, preset?: string) => {
    setIsAnalyzing(true);
    setAnalysisStep(0);
    setGeneratedPolicies(null);
    setHasApplied(false);

    // Trigger backend API call asynchronously
    let apiResult: any = null;
    const apiPromise = fetch('/api/parse-law-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: name, fileContent: content, actPreset: preset }),
    })
    .then(res => res.json())
    .then(data => { apiResult = data; })
    .catch(err => { console.error('Compliance compilation failed:', err); });

    // Step through visual compilation pipeline for cognitive immersion
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalysisStep(i);
    }

    // Await API complete
    await apiPromise;

    if (apiResult && apiResult.policies) {
      setGeneratedPolicies(apiResult.policies);
    } else {
      // Fallback local compiler database
      const localPolicies = getLocalFallbackPolicies(name, preset);
      setGeneratedPolicies(localPolicies);
    }
    setIsAnalyzing(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadingFile(file.name);
      setSelectedPreset(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        startAnalysisAnimation(file.name, text.substring(0, 10000));
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingFile(file.name);
      setSelectedPreset(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        startAnalysisAnimation(file.name, text.substring(0, 10000));
      };
      reader.readAsText(file);
    }
  };

  const handlePresetSelect = (presetKey: string, displayName: string) => {
    setSelectedPreset(presetKey);
    setUploadingFile(null);
    startAnalysisAnimation(displayName, undefined, presetKey);
  };

  const handleApplyGeneratedPolicies = () => {
    if (!generatedPolicies) return;
    
    const sourceLawName = selectedPreset ? (
      selectedPreset === 'eu-ai-act' ? 'EU AI Act (Annex IV & Art. 12)' : 
      selectedPreset === 'us-executive-order' ? 'US Federal AI Framework (2025)' : 
      selectedPreset === 'ca-sb53' || selectedPreset === 'ca-sb1047' ? 'CA SB 53 (2025 Enacted)' : 
      selectedPreset === 'co-sb-205' ? 'Colorado SB 24-205 (Tracking - June 2026)' : 'Act Preset'
    ) : (uploadingFile || 'Custom Act Document');

    generatedPolicies.forEach(policy => {
      onAddPolicy({
        ...policy,
        sourceLaw: sourceLawName
      });
    });

    setHasApplied(true);
    setTimeout(() => {
      setGeneratedPolicies(null);
      setUploadingFile(null);
      setSelectedPreset(null);
      setShowLawParser(false);
      setHasApplied(false);
    }, 2000);
  };

  const getAnalysisStepText = () => {
    switch (analysisStep) {
      case 0: return "Ingesting regulation / text document context...";
      case 1: return "Parsing legal sections and active compliance requirements...";
      case 2: return "Generating outbound action interceptors (Secure Pillar)...";
      case 3: return "Formulating brand & safety sentinels (Observe Pillar)...";
      case 4: return "Structuring session budget caps and token quotas (Measure Pillar)...";
      case 5: return "Compiling final cryptographic policies-as-code...";
      default: return "Analyzing Act framework...";
    }
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = 
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.blastRadius.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.threshold.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || policy.category === filterCategory;
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'enabled' && policy.enabled) || 
      (filterStatus === 'disabled' && !policy.enabled);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Intro Header */}
      <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/35 rounded-xl mt-1">
            <Sliders size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#1D9E75] uppercase tracking-widest bg-[#1D9E75]/10 border border-[#1D9E75]/25 px-2.2 py-0.5 rounded">
                POLICY-AS-CODE CONTROL
              </span>
              <span className="text-xs font-mono text-[#556070] font-bold">Annex IV Core Configuration</span>
            </div>
            <h1 className="text-2xl font-display font-medium text-[#F0EEE6] mt-1.5">
              Automated Policy Enforcement Ledger
            </h1>
            <p className="text-[#8B9BAA] text-sm max-w-xl mt-1">
              Configure parameters, enforce constraints over the active model deployment, or register brand guidelines 
              to alter response models immediately.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={() => {
              setShowLawParser(!showLawParser);
              setShowAddForm(false);
            }}
            className={`px-4 py-2.5 ${showLawParser ? 'bg-[#9333EA] border-[#C084FC]/30 text-white shadow-[#9333EA]/20' : 'bg-[#1F2E40] border-[#2A3E56] text-[#F0EEE6] hover:bg-[#2A3E56]'} border font-display font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer`}
            id="btn-trigger-law-parser"
          >
            <Scale size={14} /> Import Regulatory Framework (PDF)
          </button>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowLawParser(false);
            }}
            className={`px-4 py-2.5 ${showAddForm ? 'bg-[#1D9E75]/75 text-white' : 'bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white'} font-display font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer`}
            id="btn-trigger-add-policy-form"
          >
            <Plus size={14} /> Register New Policy
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2.5 text-xs font-mono font-bold">
          <CheckCircle2 size={16} /> New policy registered successfully! Synced across all active Google AI Studio native gateways.
        </div>
      )}

      {/* Interactive Regulatory PDF Translation Workspace */}
      {showLawParser && (
        <div className="p-6 bg-[#162030] border border-[#3B1F6E]/40 rounded-xl space-y-6 animate-slide-up relative overflow-hidden">
          {/* Subtle purple background highlight aura */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-900/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#1F2E40] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-[#A855F7] uppercase bg-[#A855F7]/10 border border-[#A855F7]/25 px-2 py-0.5 rounded animate-pulse">
                  REGULATORY TRANSLATION ENGINE
                </span>
                <span className="text-[10px] font-mono text-[#556070] font-bold">Secure • Observe • Measure</span>
              </div>
              <h3 className="font-display font-medium text-white text-lg mt-1 flex items-center gap-2">
                <Scale className="text-[#A855F7]" size={20} /> AI Act & Law Policy Synthesizer
              </h3>
              <p className="text-xs text-[#8B9BAA] mt-1 max-w-2xl">
                Upload a regulatory PDF or select an international law template. Our dual-path compilation pipeline 
                (Gemini Cognitive Engine & Expert Legal Systems Database) automatically maps statutory obligations into 
                enforceable JSON gateway rules.
              </p>
            </div>

            {/* Quick Presets Badge Bar */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-mono text-[#556070] font-semibold self-center mr-1">Law Presets:</span>
              <button
                onClick={() => handlePresetSelect('eu-ai-act', 'EU AI Act (Annex IV & Art. 12)')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition cursor-pointer ${selectedPreset === 'eu-ai-act' ? 'bg-[#9333EA]/20 border-[#C084FC]/50 text-[#D8B4FE]' : 'bg-[#0D1B2A]/40 border-[#1F2E40] text-[#8B9BAA] hover:border-[#556070]'}`}
              >
                🇪🇺 EU AI Act
              </button>
              <button
                onClick={() => handlePresetSelect('us-executive-order', 'US Federal AI Framework (2025)')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition cursor-pointer ${selectedPreset === 'us-executive-order' ? 'bg-[#9333EA]/20 border-[#C084FC]/50 text-[#D8B4FE]' : 'bg-[#0D1B2A]/40 border-[#1F2E40] text-[#8B9BAA] hover:border-[#556070]'}`}
              >
                🇺🇸 US Federal AI
              </button>
              <button
                onClick={() => handlePresetSelect('ca-sb53', 'CA SB 53 (2025 Enacted)')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition cursor-pointer ${selectedPreset === 'ca-sb53' || selectedPreset === 'ca-sb1047' ? 'bg-[#9333EA]/20 border-[#C084FC]/50 text-[#D8B4FE]' : 'bg-[#0D1B2A]/40 border-[#1F2E40] text-[#8B9BAA] hover:border-[#556070]'}`}
              >
                🐻 CA SB 53 (2025)
              </button>
              <button
                onClick={() => handlePresetSelect('co-sb-205', 'Colorado SB 24-205 (Tracking)')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition cursor-pointer ${selectedPreset === 'co-sb-205' ? 'bg-[#9333EA]/20 border-[#C084FC]/50 text-[#D8B4FE]' : 'bg-[#0D1B2A]/40 border-[#1F2E40] text-[#8B9BAA] hover:border-[#556070]'}`}
              >
                🏔️ CO SB 24-205
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Upload Dropzone & Action triggers */}
            <div className="lg:col-span-4 space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition relative min-h-[180px] group ${dragActive ? 'border-[#C084FC] bg-[#A855F7]/10' : 'border-[#1F2E40] hover:border-[#A855F7]/30 bg-[#0D1B2A]/40'}`}
              >
                <input
                  type="file"
                  id="law-pdf-upload"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <UploadCloud className={`h-10 w-10 mb-2 transition ${dragActive ? 'text-[#C084FC] scale-110' : 'text-[#8B9BAA] group-hover:text-[#A855F7]'}`} />
                <p className="text-xs font-bold text-white mb-1">Drag & Drop Legal Act</p>
                <p className="text-[10px] text-[#556070] mb-3">Accepts PDF or raw compliance text (Max 10MB)</p>
                
                <label
                  htmlFor="law-pdf-upload"
                  className="px-3 py-1.5 bg-[#1F2E40] hover:bg-[#2A3E56] text-white text-[11px] font-mono font-bold rounded-md border border-[#2A3E56] transition cursor-pointer shadow-sm"
                >
                  Browse Files
                </label>
              </div>

              {/* Ingested status indicator */}
              {(uploadingFile || selectedPreset) && (
                <div className="p-3 bg-[#0D1B2A] border border-[#1F2E40] rounded-lg flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={14} className="text-[#A855F7]" />
                    <span className="text-[#8B9BAA] truncate">Source:</span>
                    <span className="text-white truncate font-semibold">
                      {uploadingFile || (
                        selectedPreset === 'eu-ai-act' ? 'EU AI Act (Annex IV Docs & Art. 12 Logs)' : 
                        selectedPreset === 'us-executive-order' ? 'US Federal AI Posture (Post-EO 14110)' : 
                        selectedPreset === 'ca-sb53' || selectedPreset === 'ca-sb1047' ? 'CA SB 53 (2025 Enacted Statute)' : 
                        selectedPreset === 'co-sb-205' ? 'Colorado SB 24-205 (Tracking - June 2026)' : 'Act Preset'
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Parsing Process & policy feedback */}
            <div className="lg:col-span-8 flex flex-col justify-center min-h-[180px]">
              {isAnalyzing ? (
                <div className="space-y-4 animate-fade-in text-center py-6">
                  <div className="relative inline-block">
                    <Loader2 size={32} className="animate-spin text-[#A855F7] mx-auto" />
                    <div className="absolute inset-0 bg-[#A855F7]/20 blur-xl rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                      COMPILING LAWS-TO-GATEWAY COGNRULESET
                    </h4>
                    <p className="text-xs text-[#8B9BAA] mt-1.5 font-mono">{getAnalysisStepText()}</p>
                  </div>
                  
                  {/* Glowing progress line */}
                  <div className="w-full max-w-sm mx-auto h-1.5 bg-[#0D1B2A] rounded-full overflow-hidden border border-[#1F2E40]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#9333EA] to-[#A855F7] rounded-full transition-all duration-300 relative"
                      style={{ width: `${(analysisStep + 1) * 16.6}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/40 blur-[1px]"></div>
                    </div>
                  </div>
                </div>
              ) : generatedPolicies ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-[#A855F7]" size={16} />
                      <h4 className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                        PROPOSED COMPLIANCE SCHEMAS
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-[#D8B4FE] bg-[#9333EA]/20 px-2 py-0.5 rounded-full border border-[#C084FC]/35">
                      Synthesis Success
                    </span>
                  </div>

                  {/* Visual Split Ledger representation */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Security Column */}
                    <div className="p-4 bg-[#090e17]/80 rounded-xl border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.05)] space-y-3">
                      <div className="flex items-center gap-2 border-b border-[#1F2E40] pb-2">
                        <Shield className="text-blue-400" size={16} />
                        <div>
                          <h4 className="text-[10px] font-mono font-black text-blue-400 tracking-wider uppercase">1. Security Pillar</h4>
                          <span className="text-[9px] text-[#556070] font-bold">Secure Gateway Control</span>
                        </div>
                      </div>
                      {generatedPolicies.find(p => p.category === 'security') ? (
                        (() => {
                          const p = generatedPolicies.find(p => p.category === 'security')!;
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-zinc-500 font-bold bg-[#0D1B2A] border border-[#1F2E40] px-1.5 py-0.5 rounded uppercase">{p.code}</span>
                                <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-500/20">SECURITY</span>
                              </div>
                              <h5 className="text-xs font-display font-bold text-white leading-tight">{p.name}</h5>
                              <p className="text-[10px] text-[#8B9BAA] leading-relaxed">{p.description}</p>
                              <div className="border-t border-[#1F2E40]/60 pt-2 flex items-center justify-between text-[9px] font-mono text-[#556070]">
                                <span>Scope: <strong className="text-[#8B9BAA]">{p.blastRadius}</strong></span>
                                <span>Limit: <strong className="text-[#8B9BAA]">{p.threshold}</strong></span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-[10px] text-[#556070] italic">No security policy generated</p>
                      )}
                    </div>

                    {/* Ethics Column */}
                    <div className="p-4 bg-[#090e17]/80 rounded-xl border border-[#1D9E75]/20 shadow-[0_0_12px_rgba(29,158,117,0.05)] space-y-3">
                      <div className="flex items-center gap-2 border-b border-[#1F2E40] pb-2">
                        <Activity className="text-[#1D9E75]" size={16} />
                        <div>
                          <h4 className="text-[10px] font-mono font-black text-[#1D9E75] tracking-wider uppercase">2. Ethics Pillar</h4>
                          <span className="text-[9px] text-[#556070] font-bold">Observe AI Sentinels</span>
                        </div>
                      </div>
                      {generatedPolicies.find(p => p.category === 'ethics') ? (
                        (() => {
                          const p = generatedPolicies.find(p => p.category === 'ethics')!;
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-zinc-500 font-bold bg-[#0D1B2A] border border-[#1F2E40] px-1.5 py-0.5 rounded uppercase">{p.code}</span>
                                <span className="text-[9px] font-mono font-bold text-[#1D9E75] bg-[#1D9E75]/10 px-1.5 py-0.5 rounded border border-[#1D9E75]/25">ETHICS</span>
                              </div>
                              <h5 className="text-xs font-display font-bold text-white leading-tight">{p.name}</h5>
                              <p className="text-[10px] text-[#8B9BAA] leading-relaxed">{p.description}</p>
                              <div className="border-t border-[#1F2E40]/60 pt-2 flex items-center justify-between text-[9px] font-mono text-[#556070]">
                                <span>Scope: <strong className="text-[#8B9BAA]">{p.blastRadius}</strong></span>
                                <span>Limit: <strong className="text-[#8B9BAA]">{p.threshold}</strong></span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-[10px] text-[#556070] italic">No ethics policy generated</p>
                      )}
                    </div>

                    {/* Finance Column */}
                    <div className="p-4 bg-[#090e17]/80 rounded-xl border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.05)] space-y-3">
                      <div className="flex items-center gap-2 border-b border-[#1F2E40] pb-2">
                        <Coins className="text-amber-400" size={16} />
                        <div>
                          <h4 className="text-[10px] font-mono font-black text-amber-400 tracking-wider uppercase">3. Finance Pillar</h4>
                          <span className="text-[9px] text-[#556070] font-bold">Measure Budget Limits</span>
                        </div>
                      </div>
                      {generatedPolicies.find(p => p.category === 'finance') ? (
                        (() => {
                          const p = generatedPolicies.find(p => p.category === 'finance')!;
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-zinc-500 font-bold bg-[#0D1B2A] border border-[#1F2E40] px-1.5 py-0.5 rounded uppercase">{p.code}</span>
                                <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/20">FINANCE</span>
                              </div>
                              <h5 className="text-xs font-display font-bold text-white leading-tight">{p.name}</h5>
                              <p className="text-[10px] text-[#8B9BAA] leading-relaxed">{p.description}</p>
                              <div className="border-t border-[#1F2E40]/60 pt-2 flex items-center justify-between text-[9px] font-mono text-[#556070]">
                                <span>Scope: <strong className="text-[#8B9BAA]">{p.blastRadius}</strong></span>
                                <span>Limit: <strong className="text-[#8B9BAA]">{p.threshold}</strong></span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-[10px] text-[#556070] italic">No finance policy generated</p>
                      )}
                    </div>
                  </div>

                  {/* Apply Actions */}
                  <div className="flex items-center justify-between border-t border-[#1F2E40] pt-3.5">
                    <p className="text-[10px] text-[#8B9BAA] flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-amber-500" /> Incorporating these policies binds legal liabilities into active gateways.
                    </p>
                    
                    <button
                      onClick={handleApplyGeneratedPolicies}
                      disabled={hasApplied}
                      className={`px-4 py-2 text-xs font-display font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 cursor-pointer shadow ${hasApplied ? 'bg-emerald-600 text-white cursor-not-allowed' : 'bg-[#9333EA] hover:bg-[#9333EA]/90 text-white'}`}
                    >
                      {hasApplied ? (
                        <>
                          <Check size={14} /> Policies Ingested!
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Incorporate Law into Gateways <ArrowRight size={12} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-[#0D1B2A]/40 border border-[#1F2E40] border-dashed rounded-xl text-center space-y-2">
                  <Scale className="mx-auto h-8 w-8 text-[#556070]" />
                  <p className="text-xs text-[#8B9BAA] font-semibold">Workspace Awaiting Document Selection</p>
                  <p className="text-[10px] text-[#556070] max-w-sm mx-auto">
                    Select one of our international law presets above or drop a compliance document to begin translating legal terms into enforcement boundaries.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register New Policy Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl space-y-4 animate-slide-up">
          <h3 className="font-display font-bold text-white text-base">Register New Policy-as-Code</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy ID Code</label>
              <input 
                type="text" 
                value={newCode} 
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/30" 
                required
              />
            </div>
            
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy Category</label>
              <select 
                value={newCat} 
                onChange={handleCategoryChange}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-350 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35"
              >
                <option value="security">Security / Kill-Switch</option>
                <option value="ethics">Ethics / Sentiment Audit</option>
                <option value="finance">Finance / Budget Caps</option>
              </select>
            </div>

            <div>
              <label className="text-[#8B9BAA] block mb-1">Target Blast Radius</label>
              <input 
                type="text" 
                value={newRadius} 
                onChange={(e) => setNewRadius(e.target.value)}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy Name *</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (formError?.name) setFormError(prev => prev ? { ...prev, name: undefined } : null);
                }}
                placeholder="e.g. Purge Command Validation Core"
                className={`w-full bg-[#0D1B2A] border rounded p-2.5 text-slate-205 font-mono focus:outline-none ${formError?.name ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-[#1F2E40] focus:ring-1 focus:ring-[#1D9E75]/35'}`} 
              />
              {formError?.name && (
                <span className="text-[10px] text-red-400 font-mono mt-1 block font-bold flex items-center gap-1">
                  <AlertCircle size={10} /> {formError.name}
                </span>
              )}
            </div>

            <div>
              <label className="text-[#8B9BAA] block mb-1">Target Threshold Standard</label>
              <input 
                type="text" 
                value={newThreshold} 
                onChange={(e) => setNewThreshold(e.target.value)}
                placeholder="e.g. Halt on budget spike past $25"
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-205 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-[#8B9BAA] block mb-1">Description / Constraint Logic rules *</label>
            <textarea 
              value={newDesc} 
              onChange={(e) => {
                setNewDesc(e.target.value);
                if (formError?.desc) setFormError(prev => prev ? { ...prev, desc: undefined } : null);
              }}
              placeholder="Provide exact rules for the Policy Interceptor to evaluate."
              className={`w-full h-20 bg-[#0D1B2A] border rounded p-2.5 text-slate-200 font-mono focus:outline-none ${formError?.desc ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-[#1F2E40] focus:ring-1 focus:ring-[#1D9E75]/35'}`} 
            />
            {formError?.desc && (
              <span className="text-[10px] text-red-400 font-mono mt-1 block font-bold flex items-center gap-1">
                <AlertCircle size={10} /> {formError.desc}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 text-xs font-mono mt-2">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-[#0D1B2A] border border-[#1F2E40] text-[#8B9BAA] hover:text-[#F0EEE6] rounded cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white rounded shadow font-medium cursor-pointer"
              id="btn-register-policy-submit"
            >
              Create Policy
            </button>
          </div>
        </form>
      )}

      {/* Category Breakdowns Info panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E24B4A]/10 text-[#E24B4A] rounded-lg">
              <Shield size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Security Policies</span>
              <span className="text-sm font-display font-medium text-white">Active Interceptors</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#E24B4A] bg-[#E24B4A]/10 border border-[#E24B4A]/20 px-2.5 py-0.5 rounded-full">
            {secCount}
          </span>
        </div>

        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1D9E75]/10 text-[#1D9E75] rounded-lg">
              <Activity size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Ethics & Bias Policies</span>
              <span className="text-sm font-display font-medium text-white">Google AI Studio Sentinels</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#1D9E75] bg-[#1D9E75]/10 border border-[#1D9E75]/20 px-2.5 py-0.5 rounded-full">
            {ethCount}
          </span>
        </div>

        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EF9F27]/10 text-[#EF9F27] rounded-lg">
              <Coins size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Finance Policies</span>
              <span className="text-sm font-display font-medium text-white">Value Budget Limits</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#EF9F27] bg-[#EF9F27]/10 border border-[#EF9F27]/20 px-2.5 py-0.5 rounded-full">
            {finCount}
          </span>
        </div>
      </div>

      {/* Active Regulatory Frameworks Section */}
      {(() => {
        const activeLaws = Array.from(new Set(policies.filter(p => p.sourceLaw).map(p => p.sourceLaw as string)));
        if (activeLaws.length === 0) return null;

        return (
          <div className="p-5 bg-[#162030] border border-purple-500/10 rounded-xl space-y-3.5 animate-fade-in">
            <div className="flex items-center gap-2 border-b border-[#1F2E40] pb-2.5">
              <Scale size={16} className="text-[#A855F7]" />
              <h3 className="text-xs font-mono font-black text-white tracking-wider uppercase">
                Active Regulatory Frameworks ({activeLaws.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeLaws.map((lawName) => {
                const lawPoliciesCount = policies.filter(p => p.sourceLaw === lawName).length;
                return (
                  <div 
                    key={lawName} 
                    className="p-3 bg-[#0D1B2A] border border-[#1F2E40] rounded-lg flex items-center justify-between hover:border-purple-500/20 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-display font-bold text-white truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        {lawName}
                      </h4>
                      <p className="text-[10px] text-purple-400 font-mono font-bold">
                        {lawPoliciesCount} active enforcement {lawPoliciesCount === 1 ? 'rule' : 'rules'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLawToRemove(lawName)}
                      className="px-2 py-1 bg-red-950/20 hover:bg-red-500/10 hover:text-[#E24B4A] text-zinc-500 border border-transparent hover:border-red-500/20 rounded transition text-[10px] font-mono flex items-center gap-1 cursor-pointer select-none font-bold"
                      title={`Remove entire ${lawName} framework`}
                    >
                      <Trash2 size={12} /> Remove Law
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search policies by code, name, description, blast radius..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
            id="search-policies-input"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer select-none font-bold bg-transparent border-none outline-none"
              id="clear-search-btn"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Category</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-350 font-mono focus:outline-none focus:border-zinc-700"
              id="filter-category-select"
            >
              <option value="all">All</option>
              <option value="security">Security</option>
              <option value="ethics">Ethics</option>
              <option value="finance">Finance</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-zinc-950 border border-zinc-805 rounded p-2 text-xs text-zinc-350 font-mono focus:outline-none focus:border-zinc-700"
              id="filter-status-select"
            >
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {(searchQuery || filterCategory !== 'all' || filterStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterStatus('all');
              }}
              className="px-3 py-2 text-[#E24B4A] hover:bg-red-950/20 border border-zinc-800 hover:border-[#E24B4A]/40 bg-zinc-950 text-xs font-mono tracking-wider font-bold rounded transition cursor-pointer select-none"
              id="reset-policies-filter-btn"
            >
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Policies Grid list */}
      <div className="space-y-4">
        {filteredPolicies.length === 0 ? (
          <div className="p-12 rounded-xl bg-[#162030] border border-[#1F2E40] text-center">
            <Sliders size={32} className="mx-auto text-zinc-500 opacity-40 mb-3 animate-pulse" />
            <h4 className="font-display font-semibold text-zinc-400 text-sm">No Enforced Policies Found</h4>
            <p className="text-zinc-500 text-xs mt-1 max-w-md mx-auto">
              No matching rules matched your current search parameters. Clear query or category bounds to view active ledgers.
            </p>
          </div>
        ) : (
          filteredPolicies.map((policy) => (
          <div 
            key={policy.id} 
            className="p-5 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-[#1D9E75]/35 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2.5 flex-1 max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10.5px] bg-[#0D1B2A] text-[#8B9BAA] border border-[#1F2E40] font-bold rounded">
                  {policy.code}
                </span>

                <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase border rounded ${
                  policy.category === 'security' 
                    ? 'bg-[#E24B4A]/10 text-[#E24B4A] border-[#E24B4A]/25' 
                    : policy.category === 'ethics' 
                      ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/25' 
                      : 'bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/25'
                }`}>
                  {policy.category}
                </span>

                {policy.sourceLaw && (
                  <span className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase bg-purple-950/40 text-purple-400 border border-purple-500/25 rounded flex items-center gap-1">
                    <Scale size={10} /> {policy.sourceLaw}
                  </span>
                )}

                <span className="text-xs font-mono text-[#556070] font-semibold">
                  Blast: <strong className="text-slate-300">{policy.blastRadius}</strong>
                </span>

                <span className="text-xs font-mono text-[#556070] font-semibold">
                  Threshold: <strong className="text-slate-300">{policy.threshold}</strong>
                </span>
              </div>

              <div>
                <h4 className="font-display font-semibold text-white text-base">
                  {policy.name}
                </h4>
                <p className="text-[#8B9BAA] text-xs mt-1 leading-relaxed">
                  {policy.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <button
                onClick={() => onTogglePolicy(policy.id)}
                className="flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-white transition cursor-pointer"
              >
                {policy.enabled ? (
                  <>
                    <ToggleRight size={26} className="text-[#1D9E75]" />
                    <span className="font-semibold text-[#1D9E75]">ENABLED</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={26} className="text-[#556070]" />
                    <span className="text-[#556070] font-bold">DISABLED</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setPolicyToDelete(policy)}
                className="p-2 hover:bg-red-500/10 hover:text-[#E24B4A] text-[#556070] border border-transparent rounded transition cursor-pointer"
                title="Delete policy"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )))}
      </div>

      {/* Confirmation Modal: Delete Individual Policy */}
      <ConfirmationModal
        isOpen={Boolean(policyToDelete)}
        onClose={() => setPolicyToDelete(null)}
        onConfirm={() => {
          if (policyToDelete) {
            onDeletePolicy(policyToDelete.id);
            setPolicyToDelete(null);
          }
        }}
        title={`Purge Policy ${policyToDelete?.code}?`}
        description={`This will permanently remove policy "${policyToDelete?.name}" from gateway intercept rules. Connected AI agents will no longer be evaluated against this rule.`}
        confirmLabel="Purge Policy"
        cancelLabel="Cancel"
        severity="danger"
        badgeText="POLICY PURGE"
        detailsList={[
          `Code: ${policyToDelete?.code}`,
          `Category: ${policyToDelete?.category}`,
          `Blast Radius: ${policyToDelete?.blastRadius}`
        ]}
      />

      {/* Confirmation Modal: Remove Law Framework */}
      <ConfirmationModal
        isOpen={Boolean(lawToRemove)}
        onClose={() => setLawToRemove(null)}
        onConfirm={() => {
          if (lawToRemove) {
            const toDelete = policies.filter(p => p.sourceLaw === lawToRemove);
            toDelete.forEach(p => onDeletePolicy(p.id));
            setLawToRemove(null);
          }
        }}
        title={`Remove ${lawToRemove} Legal Framework?`}
        description={`This action will delete all active enforcement rules mapped from ${lawToRemove}. API gateway proxy nodes will no longer enforce these statutory constraints.`}
        confirmLabel={`Purge ${lawToRemove} Framework`}
        cancelLabel="Keep Legal Framework"
        severity="danger"
        badgeText="LEGAL FRAMEWORK REMOVAL"
        detailsList={[
          `Framework: ${lawToRemove}`,
          `Rules Affected: ${policies.filter(p => p.sourceLaw === lawToRemove).length} active policy rules`
        ]}
      />
    </div>
  );
}
