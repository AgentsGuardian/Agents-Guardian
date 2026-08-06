/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Coins, AlertTriangle, DollarSign, RefreshCw, Layers, Sparkles, Check, Sliders, Briefcase, Zap, Calculator, ShieldCheck } from 'lucide-react';
import { ValueMeterMetric, LaborConfig } from '../types';

interface MeasurePillarProps {
  valueMetrics: ValueMeterMetric[];
  onRefineAgent: (id: string) => void;
  onAddMetricEvent: (newMetric: ValueMeterMetric) => void;
  budgetCap: number;
  onUpdateBudgetCap: (cap: number) => void;
  laborConfig?: LaborConfig;
  onUpdateLaborConfig?: (config: LaborConfig) => void;
}

export default function MeasurePillar({
  valueMetrics,
  onRefineAgent,
  onAddMetricEvent,
  budgetCap,
  onUpdateBudgetCap,
  laborConfig,
  onUpdateLaborConfig,
}: MeasurePillarProps) {
  const [sessionCap, setSessionCap] = useState<number>(budgetCap);
  const [successMsg, setSuccessMsg] = useState<boolean>(false);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [selectedTaskScenario, setSelectedTaskScenario] = useState<string>('password-resets');

  // Feature 2: Interactive Human Labor Cost Configuration states
  const defaultLabor: LaborConfig = laborConfig || {
    l1Rate: 35,
    l2Rate: 75,
    l3Rate: 150,
    auditRate: 60,
    avgHoursPerTask: 0.25
  };

  const [localL1, setLocalL1] = useState<number>(defaultLabor.l1Rate);
  const [localL2, setLocalL2] = useState<number>(defaultLabor.l2Rate);
  const [localL3, setLocalL3] = useState<number>(defaultLabor.l3Rate);
  const [localAudit, setLocalAudit] = useState<number>(defaultLabor.auditRate);
  const [localAvgHrs, setLocalAvgHrs] = useState<number>(defaultLabor.avgHoursPerTask);
  const [simTaskCount, setSimTaskCount] = useState<number>(1000);
  const [laborSavedMsg, setLaborSavedMsg] = useState<boolean>(false);

  // Dynamic Live Equivalency Calculations
  const calcHumanCost = Math.round(simTaskCount * localAvgHrs * localL1 * 100) / 100;
  const calcAiCost = Math.round((simTaskCount * 0.0425) * 100) / 100;
  const calcSavings = Math.round((calcHumanCost - calcAiCost) * 100) / 100;
  const calcRoi = calcAiCost > 0 ? (calcHumanCost / calcAiCost).toFixed(1) : '0';

  const applyPreset = (preset: 'servicedesk' | 'fintech' | 'healthcare' | 'enterprise') => {
    if (preset === 'servicedesk') {
      setLocalL1(35); setLocalL2(75); setLocalL3(150); setLocalAudit(60); setLocalAvgHrs(0.25);
    } else if (preset === 'fintech') {
      setLocalL1(65); setLocalL2(140); setLocalL3(250); setLocalAudit(100); setLocalAvgHrs(0.35);
    } else if (preset === 'healthcare') {
      setLocalL1(55); setLocalL2(120); setLocalL3(220); setLocalAudit(85); setLocalAvgHrs(0.30);
    } else {
      setLocalL1(45); setLocalL2(95); setLocalL3(180); setLocalAudit(75); setLocalAvgHrs(0.20);
    }
  };

  const handleSaveLaborConfig = () => {
    if (onUpdateLaborConfig) {
      onUpdateLaborConfig({
        l1Rate: localL1,
        l2Rate: localL2,
        l3Rate: localL3,
        auditRate: localAudit,
        avgHoursPerTask: localAvgHrs
      });
    }
    setLaborSavedMsg(true);
    setTimeout(() => setLaborSavedMsg(false), 2500);
  };

  // Stats
  const totalSpend = valueMetrics.reduce((acc, m) => acc + m.totalApiSpend, 0);
  const totalLaborSaved = valueMetrics.reduce((acc, m) => acc + m.humanLaborSaved, 0);
  // Efficiency Formula: (Human Labor Saved / Total API Spend) = AI ROI Score
  const cumulativeRoi = totalSpend > 0 ? totalLaborSaved / totalSpend : 0;
  const alertCount = valueMetrics.filter(e => e.status === 'ALERT').length;

  const handleUpdateCap = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBudgetCap(sessionCap);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 2500);
  };

  const triggerTaskSimulation = () => {
    if (simRunning) return;
    setSimRunning(true);

    const scenarioName = selectedTaskScenario === 'password-resets' ? '500 Password Resets'
      : selectedTaskScenario === 'l1-triage-surge' ? 'L1 Triage Surge'
      : selectedTaskScenario === 'sre-incident-remediation' ? 'SRE Incident Remediation'
      : selectedTaskScenario === 'infinite-loop-drain' ? 'Runaway Infinite Loop'
      : '1M Token Context Bloat';

    fetch('/api/economic/stress-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioName })
    })
      .then(res => res.json())
      .then(resData => {
        const randId = `VAL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const now = new Date().toISOString();

        const agentName = selectedTaskScenario === 'password-resets' ? 'PasswordReset-Agent-HQ'
          : selectedTaskScenario === 'l1-triage-surge' ? 'AutoGen-TriageHQ'
          : selectedTaskScenario === 'sre-incident-remediation' ? 'SRE-LogParser-Pro'
          : selectedTaskScenario === 'infinite-loop-drain' ? 'Rogue-Recursive-Scraper'
          : 'EnterpriseParser-V5';

        const metric: ValueMeterMetric = {
          id: randId,
          timestamp: now,
          agentName,
          completedTasks: resData.tasksCount || 500,
          totalApiSpend: resData.tokenSpend || 42.50,
          humanLaborSaved: resData.humanCostEquiv || 437.50,
          roiScore: typeof resData.tokenSpend === 'number' && resData.tokenSpend > 0 ? resData.humanCostEquiv / resData.tokenSpend : 10,
          status: resData.tokenSpend > budgetCap ? 'ALERT' : 'STABLE',
          latestViolatingCost: resData.tokenSpend > budgetCap ? resData.tokenSpend : undefined
        };

        onAddMetricEvent(metric);
        setSimRunning(false);
      })
      .catch(() => {
        setSimRunning(false);
      });
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Pillar Introduction Header */}
      <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/30 rounded-xl mt-1">
            <Coins size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#EF9F27] uppercase tracking-widest bg-[#EF9F27]/10 border border-[#EF9F27]/25 px-2.2 py-0.5 rounded">
                PILLAR 3: MEASURE
              </span>
              <span className="text-xs font-mono text-[#556070] font-bold">ERP Asset Data Integrator</span>
            </div>
            <h1 className="text-xl font-display font-medium text-[#F0EEE6] mt-1.5 animate-pulse">
              AI Value Meter & Economic Process Tracker
            </h1>
            <p className="text-[#8B9BAA] text-sm max-w-xl mt-1">
              Tracks token expenditures in real-time, matching industry labor assets to monitor net economic yields, 
              averting finance drift, and capping bloated conversational runtimes.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-xs font-mono text-[#8B9BAA] font-semibold bg-[#0D1B2A] border border-[#1F2E40] p-2.5 rounded-lg text-right shrink-0">
            <span className="text-[10px] text-[#556070] block uppercase">Formula</span>
            (Saved labor / spend) = ROI
          </span>
        </div>
      </div>

      {/* AI Value Meter Flow diagram */}
      <div className="bg-[#162030] rounded-xl border border-[#1F2E40] p-6 relative">
        <h2 className="text-sm font-mono font-bold text-[#8B9BAA] tracking-wider uppercase mb-5">
          <span className="text-[#1D9E75]">●</span> AI VALUE METER: ECONOMIC PROCESS FRAMEWORK
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="hidden md:block absolute top-[2.2rem] left-[12%] right-[12%] h-0.5 border-t border-dashed border-[#1F2E40] z-0" />

          {/* Block 1 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-1">STAGE 01</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#EF9F27] flex items-center justify-center text-[10px] font-mono font-bold">
              SPEND
            </div>
            <h4 className="font-display font-semibold text-[#F0EEE6] mt-2.5 text-xs">Spend Tracking</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Real-time token and API spend ingestion (ERP Ledger).
            </p>
          </div>

          {/* Block 2 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">STAGE 02</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#EF9F27] flex items-center justify-center text-[10px] font-mono font-bold">
              LABOR
            </div>
            <h4 className="font-display font-semibold text-[#F0EEE6] mt-2.5 text-xs">Labor Reference</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Enterprise registry provides "Human Equivalent" wage rates.
            </p>
          </div>

          {/* Block 3 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">STAGE 03</span>
            <div className="w-10 h-10 rounded-full bg-[#162030] border border-[#1F2E40] text-[#EF9F27] flex items-center justify-center text-[10px] font-mono font-bold">
              ROI
            </div>
            <h4 className="font-display font-semibold text-[#F0EEE6] mt-2.5 text-xs">ROI Analytics</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              AG algorithm calculates Dollars Saved vs Spend.
            </p>
          </div>

          {/* Block 4 */}
          <div className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center flex flex-col items-center relative z-10">
            <span className="text-[9px] font-mono font-bold text-[#556070] tracking-widest block mb-2">STAGE 04</span>
            <div className="w-10 h-10 rounded-full bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/30 flex items-center justify-center text-[10px] font-mono font-bold animate-pulse">
              CFO
            </div>
            <h4 className="font-display font-semibold text-[#F0EEE6] mt-2.5 text-xs">CFO Alerting</h4>
            <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug">
              Reports triggered to Finance if Cost &gt; Labor Value.
            </p>
          </div>
        </div>

        {/* Efficiency Formula banner block layout */}
        <div className="mt-5 p-4 rounded bg-[#0D1B2A] border border-[#1F2E40] text-center">
          <span className="text-xs font-mono font-bold tracking-wider text-[#8B9BAA]">
            Efficiency Formula: <span className="text-[#EF9F27] font-semibold">(Human Labor Saved / Total API Spend)</span> = AI ROI Score
          </span>
        </div>
      </div>

      {/* Main Split Layout: Left CFO Budget controls, Right CFO Journey visual steps */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Workbench Panel: Budget Cap & Labor Configuration */}
        <div className="lg:col-span-12 xl:col-span-6 p-6 bg-[#162030] border border-[#1F2E40] rounded-xl flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdateCap} className="space-y-6">
            
            {/* SECTION 1: BUDGET CAP */}
            <div className="p-4 rounded-xl bg-[#0D1B2A] border border-[#1F2E40] space-y-3">
              <div className="flex items-center justify-between border-b border-[#1F2E40] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#EF9F27]/15 rounded text-[#EF9F27]">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-mono font-bold text-[#EF9F27] uppercase tracking-wider block">Feature 01 • Financial Limit</span>
                    <h3 className="font-display font-bold text-white text-sm">Active Session Budget Cap Control</h3>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                  Runtime Gate
                </span>
              </div>

              <p className="text-xs text-[#8B9BAA] leading-relaxed">
                Step 1: Establish the "Agentic Budget" cap. Any individual task session accumulating expenditures exceeding this mark triggers an automated halt.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block">
                  Active Session Budget Cap (USD)
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
                    $
                  </div>
                  <input
                    type="number"
                    step="5"
                    value={sessionCap}
                    onChange={(e) => setSessionCap(Number(e.target.value))}
                    className="w-full bg-[#162030] border border-[#1F2E40] rounded-lg p-2.5 pl-7 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#EF9F27]/30"
                    id="input-budget-cap"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-[#1D9E75]/10 hover:bg-[#1D9E75] hover:text-[#0D1B2A] text-[#1D9E75] font-display font-bold text-xs rounded-lg transition border border-[#1D9E75]/35 font-semibold cursor-pointer"
                id="btn-update-budget"
              >
                Update Budget Parameters
              </button>
              {successMsg && (
                <p className="text-center text-xs text-emerald-400 font-mono mt-2 animate-bounce flex items-center justify-center gap-1.5 font-bold">
                  <Check size={12} /> Parameters Synchronized with Gateway!
                </p>
              )}
            </div>

            {/* SECTION 2: INTERACTIVE HUMAN LABOR COST CONFIGURATION */}
            <div className="p-4 rounded-xl bg-[#0D1B2A] border border-[#EF9F27]/40 space-y-4 shadow-lg relative">
              <div className="flex items-center justify-between border-b border-[#1F2E40] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#EF9F27]/15 rounded text-[#EF9F27]">
                    <Sliders size={16} />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-mono font-bold text-[#EF9F27] uppercase tracking-wider block">Feature 02 • Core Benchmark</span>
                    <h3 className="font-display font-bold text-white text-sm">Interactive Human Labor Cost Configuration</h3>
                  </div>
                </div>
                <span className="text-[10px] bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/30 px-2 py-0.5 rounded font-mono font-bold animate-pulse">
                  Active Sync
                </span>
              </div>

              <p className="text-xs text-[#8B9BAA] leading-relaxed">
                Configure regional wage rates and ticket handling benchmarks. Modifying these parameters dynamically re-indexes AI ROI multipliers and labor avoidance metrics across your entire GaaS ecosystem.
              </p>

              {/* Quick Benchmarks */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-[#8B9BAA] font-bold uppercase tracking-wider block">
                  Select Corporate Wage Preset:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button type="button" onClick={() => applyPreset('servicedesk')} className="px-2 py-1.5 text-[10px] font-mono rounded bg-[#162030] hover:bg-[#1F2E40] text-slate-300 border border-[#1F2E40] transition cursor-pointer">
                    IT Service Desk ($35/hr)
                  </button>
                  <button type="button" onClick={() => applyPreset('fintech')} className="px-2 py-1.5 text-[10px] font-mono rounded bg-[#162030] hover:bg-[#1F2E40] text-slate-300 border border-[#1F2E40] transition cursor-pointer">
                    FinTech ($65/hr)
                  </button>
                  <button type="button" onClick={() => applyPreset('healthcare')} className="px-2 py-1.5 text-[10px] font-mono rounded bg-[#162030] hover:bg-[#1F2E40] text-slate-300 border border-[#1F2E40] transition cursor-pointer">
                    Healthcare ($55/hr)
                  </button>
                  <button type="button" onClick={() => applyPreset('enterprise')} className="px-2 py-1.5 text-[10px] font-mono rounded bg-[#162030] hover:bg-[#1F2E40] text-slate-300 border border-[#1F2E40] transition cursor-pointer">
                    Enterprise ($45/hr)
                  </button>
                </div>
              </div>

              {/* Sliders for Rates */}
              <div className="space-y-3 pt-2">
                {/* L1 Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <Briefcase size={12} className="text-blue-400" /> L1 Support / Triage Rate:
                    </span>
                    <span className="font-mono font-bold text-[#EF9F27]">${localL1}.00 / hr</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="150"
                    step="5"
                    value={localL1}
                    onChange={(e) => setLocalL1(Number(e.target.value))}
                    className="w-full accent-[#EF9F27] bg-[#162030] h-1.5 rounded-lg cursor-pointer"
                    id="slider-l1-rate"
                  />
                </div>

                {/* L2 Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <Zap size={12} className="text-teal-400" /> L2 DevOps Engineer Rate:
                    </span>
                    <span className="font-mono font-bold text-[#1D9E75]">${localL2}.00 / hr</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="250"
                    step="5"
                    value={localL2}
                    onChange={(e) => setLocalL2(Number(e.target.value))}
                    className="w-full accent-[#1D9E75] bg-[#162030] h-1.5 rounded-lg cursor-pointer"
                    id="slider-l2-rate"
                  />
                </div>

                {/* L3 Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-purple-400" /> L3 SRE Architect Rate:
                    </span>
                    <span className="font-mono font-bold text-purple-400">${localL3}.00 / hr</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="400"
                    step="10"
                    value={localL3}
                    onChange={(e) => setLocalL3(Number(e.target.value))}
                    className="w-full accent-purple-400 bg-[#162030] h-1.5 rounded-lg cursor-pointer"
                    id="slider-l3-rate"
                  />
                </div>

                {/* Human-in-the-Loop Security Auditor Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-indigo-400" /> Human-in-the-Loop Security Auditor Rate:
                    </span>
                    <span className="font-mono font-bold text-indigo-400">${localAudit}.00 / hr</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="200"
                    step="5"
                    value={localAudit}
                    onChange={(e) => setLocalAudit(Number(e.target.value))}
                    className="w-full accent-indigo-400 bg-[#162030] h-1.5 rounded-lg cursor-pointer"
                    id="slider-audit-rate"
                  />
                </div>

                {/* Avg handling time */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <Calculator size={12} className="text-amber-400" /> Avg Human Handling Time per Ticket:
                    </span>
                    <span className="font-mono font-bold text-white">{Math.round(localAvgHrs * 60)} mins ({localAvgHrs} hrs)</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.50"
                    step="0.05"
                    value={localAvgHrs}
                    onChange={(e) => setLocalAvgHrs(Number(e.target.value))}
                    className="w-full accent-amber-400 bg-[#162030] h-1.5 rounded-lg cursor-pointer"
                    id="slider-avg-hrs"
                  />
                </div>
              </div>

              {/* Wage Reference Citation & Methodology Note */}
              <div className="p-3 bg-[#162030]/80 border border-[#1F2E40] rounded-lg text-[10px] text-[#8B9BAA] space-y-1 font-mono">
                <span className="text-amber-400 font-bold block uppercase">📊 Benchmark Reference Citation & Methodology:</span>
                <p className="leading-relaxed">
                  Default hourly rate baselines ($35 L1 Triage, $75 L2 Systems/DevOps, $150 L3 SRE, $60 Security Auditor) are benchmarked against US Bureau of Labor Statistics (BLS) SOC 15-1212 & SOC 15-1244 median wage statistics, scaled by a standard 1.38x enterprise fully-burdened overhead multiplier (benefits, employer taxes, IT overhead). Adjust sliders to match your enterprise's specific HR procurement rates.
                </p>
              </div>

              {/* Real-time Dynamic Equivalency Preview Box */}
              <div className="p-3 bg-[#162030] border border-[#1F2E40] rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#8B9BAA]">Live Benchmarking (Volume: 1,000 Tasks):</span>
                  <span className="text-emerald-400 font-bold">{calcRoi}x Net ROI Multiplier</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#1F2E40]">
                  <div className="p-1.5 bg-[#0D1B2A] rounded">
                    <span className="text-[9px] font-mono text-[#8B9BAA] block uppercase">Human Cost</span>
                    <span className="text-xs font-mono font-bold text-slate-200">${calcHumanCost.toLocaleString()}</span>
                  </div>
                  <div className="p-1.5 bg-[#0D1B2A] rounded">
                    <span className="text-[9px] font-mono text-[#8B9BAA] block uppercase">AI Spend</span>
                    <span className="text-xs font-mono font-bold text-amber-400">${calcAiCost.toLocaleString()}</span>
                  </div>
                  <div className="p-1.5 bg-[#0D1B2A] rounded border border-emerald-500/30">
                    <span className="text-[9px] font-mono text-emerald-400 block uppercase">Net Savings</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">${calcSavings.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveLaborConfig}
                className="w-full py-2.5 px-4 bg-[#EF9F27] hover:bg-[#EF9F27]/90 text-slate-950 font-display font-bold text-xs rounded-lg transition font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md"
                id="btn-sync-labor-config"
              >
                <Check size={14} /> Synchronize Labor Wage Parameters with Global Engine
              </button>
              {laborSavedMsg && (
                <p className="text-center text-xs text-emerald-400 font-mono mt-1.5 animate-bounce flex items-center justify-center gap-1.5 font-bold">
                  <Check size={12} /> Labor Rates & ROI Multipliers Updated System-Wide!
                </p>
              )}
            </div>

            {/* SECTION 3: ECONOMIC SIMULATION ENGINE */}
            <div className="p-4 rounded-xl bg-[#0D1B2A] border border-[#1F2E40] space-y-3">
              <div className="flex items-center justify-between border-b border-[#1F2E40] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#EF9F27]/15 rounded text-[#EF9F27]">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-mono font-bold text-[#EF9F27] uppercase tracking-wider block">Feature 03 • Stress Testing</span>
                    <h3 className="font-display font-bold text-white text-sm">Economic Simulation Engine</h3>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                  6 Scenarios
                </span>
              </div>

              <p className="text-xs text-[#8B9BAA] leading-relaxed">
                Run operational stress tests comparing AI API burn rates against your configured human labor wage benchmarks.
              </p>

              <div className="space-y-2">
                <select
                  value={selectedTaskScenario}
                  onChange={(e) => setSelectedTaskScenario(e.target.value)}
                  className="w-full text-xs font-mono bg-[#162030] border border-[#1F2E40] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#EF9F27]/30"
                  id="select-economic-scenario"
                >
                  <option value="password-resets">High ROI Task Scenario: 500 Password Resets (@ ${localL1}/hr L1 Rate)</option>
                  <option value="l1-triage-surge">High-Volume L1 Ticket Triage Surge: 2,500 Tickets (@ ${localL1}/hr)</option>
                  <option value="sre-incident-remediation">Enterprise SRE Log Remediation: 50 Critical Incidents (@ ${localL3}/hr L3 Rate)</option>
                  <option value="custom-labor-benchmark">Dynamic Labor Benchmark Test: 1,000 Tasks (Using Active Labor Config)</option>
                  <option value="context-bloat">Runaway Cost Scenario: 1M Token Context Bloat (&gt;${sessionCap} Budget Cap)</option>
                  <option value="infinite-loop-drain">Runaway Multi-Agent Infinite Loop ($185.00 API Burn before Kill-Switch trips)</option>
                </select>

                <button
                  type="button"
                  onClick={triggerTaskSimulation}
                  disabled={simRunning}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#EF9F27] to-[#EF9F27]/90 hover:from-[#EF9F27]/90 hover:to-[#EF9F27] text-slate-900 hover:text-slate-950 font-display font-bold text-xs rounded-lg transition font-bold cursor-pointer shadow-md"
                  id="btn-trigger-economic-sim"
                >
                  {simRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={13} className="animate-spin" /> RUNNING ECONOMIC EQUIVALENCY ANALYTICS...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sparkles size={13} /> Trigger Economic Scenario
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: CFO Journey Timeline steps */}
        <div className="lg:col-span-12 xl:col-span-6 space-y-6">
          <div className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-white text-base mb-1">
                AI Value Meter: CFO Journey Timeline

              </h3>
              <p className="text-xs text-[#8B9BAA] mb-5">Workflow steps representing financial constraints and event violations.</p>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/25 flex items-center justify-center font-mono text-[10px] font-bold">1</span>
                  <div>
                    <h4 className="text-xs font-display font-semibold text-slate-200">Step 1: Budget Caps</h4>
                    <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug col-slate-350">
                      CFO sets the "Agentic Budget" constraints directly in the Finance module settings of Agent Guardian.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 bg-[#0D1B2A] rounded border border-[#1F2E40] flex gap-3.5 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/25 flex items-center justify-center font-mono text-[10px] font-bold">2</span>
                  <div>
                    <h4 className="text-xs font-display font-semibold text-slate-200">Step 2: Real-time ROI calculations</h4>
                    <p className="text-[11px] text-[#8B9BAA] mt-1 leading-snug col-slate-350">
                      The analyzer tracks a support agent doing 500 password resets. Calculations verify **$15k labor saved vs only $200 API token cost** (yielding massive ROI multiplier!).
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 bg-red-950/25 rounded border border-[#E24B4A]/30 flex gap-3.5 items-start animate-pulse">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 flex items-center justify-center font-mono text-[10px] font-bold">3</span>
                  <div>
                    <h4 className="text-xs font-display font-semibold text-[#E24B4A]">Step 3: Threshold Alert Trigger</h4>
                    <p className="text-[11px] text-red-200 mt-1 leading-snug">
                      Agent context window bloats. Expenditures per task hit **$50+**, immediately triggering custom CFO **"Value Violation"** alerts to pause and refine the code agent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bar Comparison Comparison of Spend vs Value */}
      <div className="p-6 bg-[#162030] rounded-xl border border-[#1F2E40]">
        <h3 className="font-display font-medium text-[#8B9BAA] text-sm mb-4">
          Agent Financial Yields Comparison (Token Spend vs. Human labor equivalence valuation)
        </h3>

        <div className="space-y-4">
          {valueMetrics.map((item) => {
            const isAlert = item.status === 'ALERT';
            const spendPct = Math.min((item.totalApiSpend / (item.humanLaborSaved || 1)) * 100, 100);
            
            return (
              <div key={item.id} className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40]">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.2 font-mono text-[10px] bg-[#162030] border border-[#1F2E40] text-[#8B9BAA] font-bold rounded">
                      {item.id}
                    </span>
                    <span className="font-display font-semibold text-xs text-slate-300">
                      {item.agentName}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-400">
                      Spend: <strong className="text-[#E24B4A]">${item.totalApiSpend.toFixed(2)}</strong>
                    </span>
                    <span className="text-slate-400">
                      Labor Equiv: <strong className="text-[#1D9E75]">${item.humanLaborSaved.toLocaleString()}</strong>
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isAlert ? 'bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 animate-pulse' : 'bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30'}`}>
                      {item.roiScore.toFixed(1)}x ROI
                    </span>
                  </div>
                </div>

                {/* Stacked Percentage bar representing savings ratio */}
                <div className="w-full h-3 bg-[#162030] rounded-full overflow-hidden flex">
                  {/* Spend portion */}
                  <div 
                    className={`h-full ${isAlert ? 'bg-[#E24B4A]' : 'bg-[#EF9F27]'}`} 
                    style={{ width: `${Math.max(spendPct, 2)}%` }} 
                  />
                  {/* Saved portion */}
                  <div 
                    className="h-full bg-[#1D9E75]" 
                    style={{ width: `${100 - Math.max(spendPct, 2)}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CFO Budget Violations Alert Index Ledger list */}
      <div className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display font-medium text-white text-base">Economic Vigilance & Alerts Index</h3>
            <span className="text-xs text-[#8B9BAA] block mt-0.5">Automated spend protection logs matching active model run constraints</span>
          </div>
          <span className="p-1 px-2.5 rounded font-mono text-[10px] bg-[#E24B4A]/15 text-[#E24B4A] border border-[#E24B4A]/30 font-bold uppercase">
            {alertCount} Value Violations Found
          </span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {valueMetrics.map((item) => (
            <div 
              key={item.id} 
              className={`p-4 rounded-lg bg-[#0D1B2A] border ${item.status === 'ALERT' ? 'border-[#E24B4A]/40' : 'border-[#1F2E40]'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded mt-0.5 ${item.status === 'ALERT' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' : 'bg-[#162030] text-[#8B9BAA] border border-[#1F2E40]'}`}>
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-slate-200">{item.agentName} Session Review</h4>
                    <span className="text-[10.5px] text-[#556070]">
                      Completed tasks: {item.completedTasks} | Cumulative Spend: ${item.totalApiSpend.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[#556070] text-[10px] block font-bold uppercase">ROI Score</span>
                    <span className={`font-bold block ${item.status === 'ALERT' ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>
                      {item.roiScore.toFixed(2)}x
                    </span>
                  </div>

                  {item.status === 'ALERT' ? (
                    <button
                      onClick={() => onRefineAgent(item.id)}
                      className="px-3 py-1.5 bg-[#E24B4A]/10 hover:bg-[#E24B4A] hover:text-white text-[#E24B4A] rounded border border-[#E24B4A]/30 text-[11px] font-bold transition cursor-pointer"
                    >
                      Suspend & Refine Assistant Command
                    </button>
                  ) : (
                    <span className="text-[#1D9E75] bg-[#1D9E75]/10 border border-[#1D9E75]/35 px-2 py-1 rounded text-[10px] uppercase font-bold">
                      Budget Safe
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
