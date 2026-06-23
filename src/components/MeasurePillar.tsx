/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Coins, AlertTriangle, DollarSign, RefreshCw, Layers, Sparkles, Check } from 'lucide-react';
import { ValueMeterMetric } from '../types';

interface MeasurePillarProps {
  valueMetrics: ValueMeterMetric[];
  onRefineAgent: (id: string) => void;
  onAddMetricEvent: (newMetric: ValueMeterMetric) => void;
  budgetCap: number;
  onUpdateBudgetCap: (cap: number) => void;
}

export default function MeasurePillar({
  valueMetrics,
  onRefineAgent,
  onAddMetricEvent,
  budgetCap,
  onUpdateBudgetCap,
}: MeasurePillarProps) {
  const [sessionCap, setSessionCap] = useState<number>(budgetCap);
  const [successMsg, setSuccessMsg] = useState<boolean>(false);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [selectedTaskScenario, setSelectedTaskScenario] = useState<string>('password-resets');

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

    setTimeout(() => {
      if (selectedTaskScenario === 'password-resets') {
        const resetsMetric: ValueMeterMetric = {
          id: `VAL-${Math.floor(Math.random() * 900) + 100}`,
          timestamp: new Date().toISOString(),
          agentName: 'PasswordReset-Agent-HQ',
          completedTasks: 500,
          totalApiSpend: 200.00,
          humanLaborSaved: 15000.00, // Calculates exactly to $15k saved
          roiScore: 75.0, // (15000 / 200)
          status: 'STABLE'
        };
        onAddMetricEvent(resetsMetric);
      } else {
        const bloatedCost = 54.20;
        const bloatMetric: ValueMeterMetric = {
          id: `VAL-${Math.floor(Math.random() * 900) + 100}`,
          timestamp: new Date().toISOString(),
          agentName: 'EnterpriseParser-V5',
          completedTasks: 1,
          totalApiSpend: bloatedCost,
          humanLaborSaved: 30.00, // Standard 1hr corporate labor equivalent
          roiScore: 30 / bloatedCost,
          status: bloatedCost > budgetCap ? 'ALERT' : 'WARNING',
          latestViolatingCost: bloatedCost
        };
        onAddMetricEvent(bloatMetric);
      }
      setSimRunning(false);
    }, 1200);
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
        {/* Left Workbench Panel: Budget Cap set */}
        <div className="lg:col-span-12 xl:col-span-5 p-6 bg-[#162030] border border-[#1F2E40] rounded-xl flex flex-col justify-between">
          <form onSubmit={handleUpdateCap} className="space-y-4">
            <div className="flex items-center gap-2 mb-1.5">
              <DollarSign size={18} className="text-[#EF9F27]" />
              <h3 className="font-display font-bold text-white text-base">Economic Parameter Control</h3>
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
                  className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-2.5 pl-7 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#EF9F27]/30"
                  id="input-budget-cap"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#1D9E75]/10 hover:bg-[#1D9E75] hover:text-[#0D1B2A] text-[#1D9E75] font-display font-bold text-xs rounded-lg transition border border-[#1D9E75]/35 font-semibold cursor-pointer"
              id="btn-update-budget"
            >
              Update Budget Parameters
            </button>
            {successMsg && (
              <p className="text-center text-xs text-emerald-400 font-mono mt-2 animate-bounce flex items-center justify-center gap-1.5 font-bold">
                <Check size={12} /> Parameters Synchronized with Gateway!
              </p>
            )}

            <div className="border-t border-[#1F2E40] pt-4 mt-4">
              <label className="text-[10px] font-mono text-[#8B9BAA] tracking-wider font-bold block mb-1.5">
                Economic Simulation Engine (Operational Resets & Cost Bloat)
              </label>
              <div className="space-y-2">
                <select
                  value={selectedTaskScenario}
                  onChange={(e) => setSelectedTaskScenario(e.target.value)}
                  className="w-full text-xs font-mono bg-[#0D1B2A] border border-[#1F2E40] rounded-lg p-2 text-slate-300 focus:outline-none"
                  id="select-economic-scenario"
                >
                  <option value="password-resets">High ROI Task Scenario: 500 Password Resets</option>
                  <option value="context-bloat">Runaway Cost Scenario: 1M Token Context Bloat (&gt;$50 Budget Cap)</option>
                </select>

                <button
                  type="button"
                  onClick={triggerTaskSimulation}
                  disabled={simRunning}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#EF9F27] to-[#EF9F27]/90 hover:from-[#EF9F27]/90 hover:to-[#EF9F27] text-slate-900 hover:text-slate-950 font-display font-bold text-xs rounded-lg transition font-bold cursor-pointer"
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
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
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
