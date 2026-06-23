/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Activity, Coins, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { KillSignalEvent, DriftLogEvent, ValueMeterMetric, ApiRequestLog, AdminUser } from '../types';

interface OverviewProps {
  killEvents: KillSignalEvent[];
  driftEvents: DriftLogEvent[];
  valueMetrics: ValueMeterMetric[];
  onNavigateTab: (tabId: string) => void;
  avgLatency: number;
  overallRoi: number;
  overallCognitiveHealth: number;
  apiLogs: ApiRequestLog[];
  currentUser: AdminUser;
  policies?: any;
  addToast?: any;
}

export default function Overview({
  killEvents,
  driftEvents,
  valueMetrics,
  onNavigateTab,
  avgLatency,
  overallRoi,
  overallCognitiveHealth,
  apiLogs,
  currentUser,
}: OverviewProps) {
  // Stats calculations
  const totalHalted = killEvents.filter(e => e.status === 'HALTED').length;
  const activeDriftWarnings = driftEvents.filter(e => e.status !== 'NORMAL').length;
  const totalSpend = valueMetrics.reduce((acc, m) => acc + m.totalApiSpend, 0);
  const totalSavedValue = valueMetrics.reduce((acc, m) => acc + m.humanLaborSaved, 0);

  // Overall Governance Health Score based on ratio of authorized versus total API requests
  const totalAuthorized = apiLogs.filter(log => log.status === 'AUTHORIZED').length;
  const totalRequests = apiLogs.length;
  const governanceHealthScore = totalRequests > 0 ? (totalAuthorized / totalRequests) * 100 : 100;

  const isSuperUser = currentUser.email === 'mritunjoysingh@gmail.com';
  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const hasAccess = isSuperUser || isSuperAdmin;



  // Combine actions for a unified lifecycle ticker
  const recentActions = [
    ...killEvents.slice(0, 2).map(e => ({
      type: 'SECURE',
      title: 'Kill-Switch Intervention',
      desc: `${e.agentName} was halted on '${e.actionCommand}'`,
      time: e.timestamp,
      status: 'HALTED',
      badgeColor: 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30',
      id: e.id,
    })),
    ...driftEvents.slice(0, 2).map(e => ({
      type: 'OBSERVE',
      title: 'Cognitive Health Sentinel',
      desc: `${e.agentGroup} shifted ${e.sentimentShiftPct}% from baseline`,
      time: e.timestamp,
      status: e.status,
      badgeColor: e.status === 'CRITICAL' ? 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30' : 'bg-[#EF9F27]/12 text-[#EF9F27] border-[#EF9F27]/30',
      id: e.id,
    })),
    ...valueMetrics.slice(0, 1).map(e => ({
      type: 'MEASURE',
      title: 'AI Value Meter Alert',
      desc: `${e.agentName} ROI falls to ${e.roiScore.toFixed(1)}x`,
      time: e.timestamp,
      status: e.status,
      badgeColor: e.status === 'ALERT' ? 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30' : 'bg-[#EF9F27]/12 text-[#EF9F27] border-[#EF9F27]/30',
      id: e.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Welcome Banner / Header */}
      <div className="p-8 rounded-2xl bg-[#111E2E] border border-[#1F2E40] shadow-lg relative overflow-hidden">
        {/* Abstract design elements matching the Navy & Teal palette */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#1D9E75]/5 rounded-full blur-3xl" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-[#1D9E75]/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-[#1D9E75] uppercase bg-[#1D9E75]/10 border border-[#1D9E75]/30 px-3 py-1 rounded-md">
                UNIFIED GOVERNANCE LIFECYCLE (2026)
              </span>
              <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight text-[#F0EEE6] mt-4">
                Architecting the Guardrails of Autonomy
              </h1>
              <p className="text-[#8B9BAA] text-sm md:text-base max-w-2xl mt-2 leading-relaxed">
                AgentsGuardian orchestrates automated intent checking, ethical shift audits, and labor index value estimation 
                in a single self-healing, zero-trust container environment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Lifecycle Metrics Grid - Matches attached template look */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Secure Card */}
        <div 
          onClick={() => onNavigateTab('secure')}
          className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-[#E24B4A]/50 transition-all duration-300 cursor-pointer group shadow-md"
          id="overview-card-secure"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-lg bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/20">
              <Shield size={22} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] font-mono text-[#E24B4A] bg-[#E24B4A]/5 px-2 py-0.5 rounded border border-[#E24B4A]/20 font-semibold uppercase">
              Halt Logic Active
            </span>
          </div>
          <h3 className="text-xs font-mono text-[#556070] font-bold tracking-wider">PILLAR 1: SECURE</h3>
          <p className="text-2xl font-display font-bold text-[#F0EEE6] mt-1 leading-none group-hover:text-red-300 transition-colors">
            {totalHalted} Incidents Blocked
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[#1F2E40] pt-3">
            <span className="text-xs text-[#8B9BAA] font-mono uppercase">Av. Response</span>
            <span className="text-xs font-mono text-[#F0EEE6] font-bold">{avgLatency}ms (Required &lt;100ms)</span>
          </div>
          <div className="mt-1 pb-1 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline">
              Launch Threat Simulator <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* Observe Card */}
        <div 
          onClick={() => onNavigateTab('observe')}
          className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-[#1D9E75]/50 transition-all duration-300 cursor-pointer group shadow-md"
          id="overview-card-observe"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-lg bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20">
              <Activity size={22} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] font-mono text-[#1D9E75] bg-[#1D9E75]/5 px-2 py-0.5 rounded border border-[#1D9E75]/20 font-semibold uppercase">
              AI Studio Sentinel
            </span>
          </div>
          <h3 className="text-xs font-mono text-[#556070] font-bold tracking-wider">PILLAR 2: OBSERVE</h3>
          <p className="text-2xl font-display font-bold text-[#F0EEE6] mt-1 leading-none group-hover:text-teal-300 transition-colors">
            {overallCognitiveHealth}% Cognitive Health
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[#1F2E40] pt-3">
            <span className="text-xs text-[#8B9BAA] font-mono uppercase">Active Warnings</span>
            <span className={`text-xs font-mono ${activeDriftWarnings > 0 ? 'text-[#EF9F27] font-bold' : 'text-[#1D9E75]'}`}>
              {activeDriftWarnings} Detected
            </span>
          </div>
          <div className="mt-1 pb-1 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline">
              Inspect Cognitive Logs <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* Measure Card */}
        <div 
          onClick={() => onNavigateTab('measure')}
          className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-[#EF9F27]/50 transition-all duration-300 cursor-pointer group shadow-md"
          id="overview-card-measure"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-lg bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/20">
              <Coins size={22} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] font-mono text-[#EF9F27] bg-[#EF9F27]/5 px-2 py-0.5 rounded border border-[#EF9F27]/20 font-semibold uppercase">
              ERP Labour Sync
            </span>
          </div>
          <h3 className="text-xs font-mono text-[#556070] font-bold tracking-wider">PILLAR 3: MEASURE</h3>
          <p className="text-2xl font-display font-bold text-[#F0EEE6] mt-1 leading-none group-hover:text-[#EF9F27] transition-colors">
            {overallRoi.toFixed(1)}x Cumulative ROI
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[#1F2E40] pt-3">
            <span className="text-xs text-[#8B9BAA] font-mono uppercase">Net Savings Value</span>
            <span className="text-xs font-mono text-[#1D9E75] font-bold">
              +${(totalSavedValue - totalSpend).toLocaleString('en-US', { maximumFractionDigits: 0 })} SAVED
            </span>
          </div>
          <div className="mt-1 pb-1 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline">
              Analyze Economic Spend <ArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* Overall Governance Health Card */}
        <div 
          onClick={() => onNavigateTab('gaas')}
          className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-sky-500/50 transition-all duration-300 cursor-pointer group shadow-md"
          id="overview-card-governance"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <CheckCircle2 size={22} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-500/20 font-semibold uppercase">
              Gateway SLA Live
            </span>
          </div>
          <h3 className="text-xs font-mono text-[#556070] font-bold tracking-wider">PILLAR 4: GOVERNANCE</h3>
          <p className="text-2xl font-display font-bold text-[#F0EEE6] mt-1 leading-none group-hover:text-sky-300 transition-colors">
            {governanceHealthScore.toFixed(1)}% Health Score
          </p>
          <div className="mt-4 flex flex-col gap-2 border-t border-[#1F2E40] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8B9BAA] font-mono uppercase">Authorized API Ratio</span>
              <span className="text-xs font-mono text-[#F0EEE6] font-bold">
                {totalAuthorized} / {totalRequests}
              </span>
            </div>
            {/* Visual ratio progress tracking bar */}
            <div className="w-full h-1.5 bg-[#0D1B2A] rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${governanceHealthScore}%` }}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline">
              Inspect Gateway Traffic <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* Visual Process Flow Map matching attached design HTML */}
      <div className="bg-[#162030] rounded-xl border border-[#1F2E40] overflow-hidden p-6 relative">
        <h2 className="text-lg font-display font-bold tracking-wide text-[#F0EEE6] mb-2 ml-1">
          The Unified Governance Lifecycle
        </h2>
        <p className="text-xs text-[#8B9BAA] ml-1 mb-6">
          How AgentsGuardian creates a self-healing, deterministic environment where AI can be deployed with zero trust but total control.
        </p>

        {/* 3 Pillar Diagram blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector dashed line background */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 border-t border-dashed border-[#1F2E40] z-0" />

          {/* Secure Pillar Item */}
          <div className="relative z-10 p-5 rounded-lg bg-[#0D1B2A] border border-[#E24B4A]/20 text-center flex flex-col items-center">
            <span className="text-[#556070] text-xs font-mono font-bold uppercase mb-1">01</span>
            <div className="w-12 h-12 rounded-full bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/30 flex items-center justify-center mb-3 text-sm font-mono font-bold">
              SECURE
            </div>
            <h4 className="font-display font-bold text-[#F0EEE6] text-sm">Active Threat Restraint</h4>
            <p className="text-xs text-[#8B9BAA] mt-2 max-w-xs block leading-relaxed">
              The real-time **Kill-Switch** intercepts headless commands inside the Action Fabric container and halts risky executions.
            </p>
          </div>

          {/* Observe Pillar Item */}
          <div className="relative z-10 p-5 rounded-lg bg-[#0D1B2A] border border-[#1D9E75]/20 text-center flex flex-col items-center">
            <span className="text-[#556070] text-xs font-mono font-bold uppercase mb-1">02</span>
            <div className="w-12 h-12 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 flex items-center justify-center mb-3 text-sm font-mono font-bold animate-pulse">
              OBSERVE
            </div>
            <h4 className="font-display font-medium text-[#F0EEE6] text-sm">Ethical Stability Sentinel</h4>
            <p className="text-xs text-[#8B9BAA] mt-2 max-w-xs block leading-relaxed">
              The system monitors outputs via **Google AI Studio logs**, flagging cognitive health decline and sentiment shifts.
            </p>
          </div>

          {/* Measure Pillar Item */}
          <div className="relative z-10 p-5 rounded-lg bg-[#0D1B2A] border border-[#EF9F27]/20 text-center flex flex-col items-center">
            <span className="text-[#556070] text-xs font-mono font-bold uppercase mb-1">03</span>
            <div className="w-12 h-12 rounded-full bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/30 flex items-center justify-center mb-3 text-sm font-mono font-bold">
              MEASURE
            </div>
            <h4 className="font-display font-semibold text-[#F0EEE6] text-sm">Value Equivalency Indicer</h4>
            <p className="text-xs text-[#8B9BAA] mt-2 max-w-xs block leading-relaxed">
              Calculates cumulative **AI ROI** using standard enterprise human labor indexing scales to block context window bloat expenses.
            </p>
          </div>
        </div>

        {/* Sovereign OS Result block */}
        <div className="mt-8 mx-1 p-5 rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-center">
          <span className="text-[10px] text-[#1D9E75] font-mono font-bold tracking-widest uppercase block mb-1">
            THE SOVEREIGN OS RESULT
          </span>
          <p className="font-display font-medium text-[#F0EEE6] text-sm md:text-base italic leading-relaxed">
            &ldquo;A self-healing, deterministic environment where AI can be deployed with zero trust but total control.&rdquo;
          </p>
        </div>
      </div>



      {/* Two-Column Details Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Sentinel Events Feed */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-[#162030] border border-[#1F2E40]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-[#F0EEE6] text-base">Real-time Sentinel Events Feed</h3>
              <span className="text-xs text-[#8B9BAA] block mt-0.5">Live intercept telemetry from Google AI Studio native gateways</span>
            </div>
            <span className="p-1 px-2.5 rounded font-mono text-[10px] bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30 font-bold uppercase animate-pulse">
              LIVE MONITORING
            </span>
          </div>

          <div className="space-y-4">
            {recentActions.map((event, index) => (
              <div 
                key={`${event.id}-${index}`} 
                className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] flex items-start gap-3.5 hover:border-[#1D9E75]/30 transition-colors"
              >
                <div className={`
                  p-1.5 rounded-lg mt-0.5 
                  ${event.type === 'SECURE' ? 'bg-[#E24B4A]/10 text-[#E24B4A] border border-[#E24B4A]/20' : ''}
                  ${event.type === 'OBSERVE' ? 'bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20' : ''}
                  ${event.type === 'MEASURE' ? 'bg-[#EF9F27]/10 text-[#EF9F27] border border-[#EF9F27]/20' : ''}
                `}>
                  {event.type === 'SECURE' && <Shield size={16} />}
                  {event.type === 'OBSERVE' && <Activity size={16} />}
                  {event.type === 'MEASURE' && <Coins size={16} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xs font-mono px-1.5 py-0.2 rounded bg-[#162030] text-[#8B9BAA] border border-[#1F2E40] shrink-0 font-bold">
                      {event.id}
                    </span>
                    <span className="text-[10px] text-[#556070] font-mono">
                      {new Date(event.time).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                  </div>
                  
                  <h4 className="font-display font-semibold text-[#F0EEE6] text-sm mt-1.5">{event.title}</h4>
                  <p className="text-xs text-[#8B9BAA] mt-0.5 leading-relaxed">{event.desc}</p>
                </div>

                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${event.badgeColor}`}>
                  {event.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center">
            <p className="text-[11px] text-[#556070] font-mono">
              Displaying the latest {recentActions.length} telemetry streams for compliance reporting
            </p>
          </div>
        </div>

        {/* Right Column: Platform Capabilities Info & System Status */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* ERP Core Sync Status */}
          <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex-1">
            <h3 className="font-display font-medium text-[#F0EEE6] text-base mb-4">Enterprise Context Engine Sync</h3>
            
            <div className="space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">REST Connection Status</span>
                <span className="text-[#1D9E75] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full animate-pulse" /> SYNCHRONIZED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">Standard Labor Rate Mapping</span>
                <span className="text-[#F0EEE6] font-bold">$30.00 / Human-Hour</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">CISO Blast Radius Parameters</span>
                <span className="text-[#1D9E75] font-bold uppercase">Strict Enforcement</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">Total API Audited Requests</span>
                <span className="text-[#F0EEE6] font-bold">18,524 intercepted</span>
              </div>
            </div>
          </div>

          {/* SLA Quick Health Chart */}
          <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex-1">
            <h3 className="font-display font-medium text-[#8B9BAA] text-sm mb-4">SLA Compliance Guarantee</h3>
            
            <div className="flex items-center gap-6">
              {/* circular progress for compliance speed */}
              <div className="relative w-24 h-24 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#1F2E40]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#1D9E75]"
                    strokeWidth="3.5"
                    strokeDasharray="98, 100"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-display leading-none">
                  <span className="text-lg font-bold text-[#F0EEE6]">98.2%</span>
                  <span className="text-[8px] text-[#556070] font-mono tracking-wide mt-1">LATENCY SAFE</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-display font-semibold text-[#F0EEE6] text-sm">Deterministic Gateways</h4>
                <p className="text-xs text-[#8B9BAA] leading-relaxed">
                  98.2% of headless script executions check policies and halt in **&lt;100ms** to prevent payload write breaches.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#1D9E75] font-mono">
                  <CheckCircle2 size={12} /> Annex IV Compliant Ledger Enabled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
