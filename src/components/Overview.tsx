/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Activity, Coins, ArrowUpRight, CheckCircle2, Cpu, Gauge, Calendar, Flame, AlertTriangle, BarChart2, ShieldAlert, Sparkles, Clock, Filter } from 'lucide-react';
import { KillSignalEvent, DriftLogEvent, ValueMeterMetric, ApiRequestLog, AdminUser, GoverningAgent, Policy, LaborConfig } from '../types';
import { GUARANTEED_SLA_MS, getStatusBadge, formatTimestamp } from '../utils';

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
  policies?: Policy[];
  laborConfig?: LaborConfig;
  restConnectionStatus?: 'SYNCHRONIZED' | 'DEGRADED' | 'DISCONNECTED';
  bypassPolicyGuard?: boolean;
  addToast?: any;
  governedAgents?: GoverningAgent[];
  governanceMode?: 'setup' | 'active';
  setGovernanceMode?: (mode: 'setup' | 'active') => void;
}

const EMPTY_AGENTS: GoverningAgent[] = [];

function computeAgentHealth(agent: GoverningAgent, logs: ApiRequestLog[]) {
  const aId = (agent.id || '').trim().toLowerCase();
  const aName = (agent.name || '').trim().toLowerCase();
  const agentLogs = logs.filter((l) => {
    const lId = (l.agentId || '').trim().toLowerCase();
    const lName = (l.agentName || '').trim().toLowerCase();
    return lId === aId || (aName && (lName === aName || lId === aName));
  });
  const authorizedCount = agentLogs.filter((l) => l.status === 'AUTHORIZED').length;
  const haltedCount = agentLogs.filter((l) => l.status === 'HALTED').length;
  const totalLogs = agentLogs.length;

  let score = 100;
  if (totalLogs > 0) {
    score = Math.round((authorizedCount / totalLogs) * 100);
  } else {
    if (agent.status === 'HALTED') score = 0;
    else if (agent.status === 'ALERT') score = 35;
    else if (agent.status === 'MITIGATING') score = 65;
    else score = 100;
  }

  return {
    authorizedCount,
    haltedCount,
    totalLogs,
    score,
  };
}

export interface HeatmapDay {
  dateStr: string;
  formattedDate: string;
  fullDay: string;
  dayOfWeek: string;
  dayNum: number;
  requests: number;
  anomalies: number;
  intensity: number; // 0..4
  primaryAgent: string;
  dominantStatus: string;
  keyEventsSummary: string[];
}

function toLocalDateKey(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generate30DayHeatmapData(
  apiLogs: ApiRequestLog[],
  killEvents: KillSignalEvent[],
  driftEvents: DriftLogEvent[]
): { days: HeatmapDay[]; leadingEmptyDays: number } {
  const days: HeatmapDay[] = [];
  const endDate = new Date();
  endDate.setHours(12, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);
  const leadingEmptyDays = (startDate.getDay() + 6) % 7;

  for (let i = 29; i >= 0; i--) {
    const curDate = new Date(endDate);
    curDate.setDate(endDate.getDate() - i);
    const dateStr = toLocalDateKey(curDate);

    const matchedLogs = apiLogs.filter(l => l.timestamp && toLocalDateKey(l.timestamp) === dateStr);
    const matchedKills = killEvents.filter(k => k.timestamp && toLocalDateKey(k.timestamp) === dateStr);
    const matchedDrifts = driftEvents.filter(
      d => d.timestamp && toLocalDateKey(d.timestamp) === dateStr && !d.isTest && !(d as any).is_test && !(d as any).archived && !d.remedatedAt
    );

    const baseReqCount = matchedLogs.length;
    const haltedLogs = matchedLogs.filter(l => l.status === 'HALTED');
    const unmatchedKills = matchedKills.filter(k => {
      const kTime = new Date(k.timestamp).getTime();
      const kAgent = (k.agentId || (k as any).agent_id || k.agentName || '').trim().toLowerCase();
      return !haltedLogs.some(hl => {
        const hlTime = new Date(hl.timestamp).getTime();
        const hlAgentId = (hl.agentId || '').trim().toLowerCase();
        const hlAgentName = (hl.agentName || '').trim().toLowerCase();
        const sameAgent = !kAgent || kAgent === hlAgentId || kAgent === hlAgentName;
        return sameAgent && Math.abs(kTime - hlTime) <= 5000;
      });
    });

    const realHalted = haltedLogs.length + unmatchedKills.length;
    const realDrifts = matchedDrifts.filter(d => d.status === 'WARNING' || d.status === 'CRITICAL').length;
    const baseAnomalies = realHalted + realDrifts;

    let intensity = 0;
    if (baseReqCount > 20) intensity = 4;
    else if (baseReqCount > 10) intensity = 3;
    else if (baseReqCount > 5) intensity = 2;
    else if (baseReqCount > 0) intensity = 1;

    // Derive the actual dominant agent from real telemetry events on this day
    const agentActivity = new Map<string, number>();
    const trackAgent = (label?: string) => {
      const clean = (label || '').trim();
      if (!clean) return;
      agentActivity.set(clean, (agentActivity.get(clean) || 0) + 1);
    };
    matchedLogs.forEach(l => trackAgent(l.agentName || l.agentId));
    matchedKills.forEach(k => trackAgent(k.agentName || k.agentId || (k as any).agent_id));
    matchedDrifts.forEach(d => trackAgent(d.agentGroup || d.agentId));

    let primaryAgent = 'None';
    let maxAgentCount = 0;
    agentActivity.forEach((count, label) => {
      if (count > maxAgentCount) {
        maxAgentCount = count;
        primaryAgent = label;
      }
    });

    const keyEvents: string[] = [];
    if (baseAnomalies > 0) {
      keyEvents.push(`${baseAnomalies} policy interception event(s) recorded`);
    } else if (baseReqCount > 0) {
      keyEvents.push('100% clean policy validation rate');
    } else {
      keyEvents.push('No telemetry events recorded');
    }
    const latencySource = matchedLogs.length > 0 ? matchedLogs : matchedKills;
    const avgDayLatency = latencySource.length > 0
      ? (latencySource.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / latencySource.length).toFixed(1)
      : '0.0';
    keyEvents.push(`Mean Latency: ${avgDayLatency}ms`);

    days.push({
      dateStr,
      formattedDate: curDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDay: curDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      dayOfWeek: curDate.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: curDate.getDate(),
      requests: baseReqCount,
      anomalies: baseAnomalies,
      intensity,
      primaryAgent,
      dominantStatus: baseAnomalies > 2 ? 'ALERT' : baseAnomalies > 0 ? 'WARNING' : 'NOMINAL',
      keyEventsSummary: keyEvents,
    });
  }

  return { days, leadingEmptyDays };
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
  policies = [],
  laborConfig,
  restConnectionStatus = 'SYNCHRONIZED',
  bypassPolicyGuard = false,
  governedAgents = EMPTY_AGENTS,
  governanceMode = 'setup',
  setGovernanceMode
}: OverviewProps) {
  // Stats calculations
  const totalHalted = killEvents.filter(e => e.status === 'HALTED').length;
  const activeDriftWarnings = driftEvents.filter(e => {
    if (e.isTest || (e as any).is_test || (e as any).archived || e.remedatedAt) return false;
    if (typeof e.cognitiveHealthScore === 'number') {
      return e.cognitiveHealthScore <= 85;
    }
    return e.status === 'WARNING' || e.status === 'CRITICAL';
  }).length;
  const totalSpend = valueMetrics.reduce((acc, m) => acc + m.totalApiSpend, 0);
  const totalSavedValue = valueMetrics.reduce((acc, m) => acc + m.humanLaborSaved, 0);
  const netSavingsValue = totalSavedValue - totalSpend;

  // Overall Governance Health Score based on ratio of authorized versus total API requests
  const totalAuthorized = apiLogs.filter(log => log.status === 'AUTHORIZED').length;
  const totalRequests = apiLogs.length;
  const governanceHealthScore = totalRequests > 0 ? (totalAuthorized / totalRequests) * 100 : 100;

  // Real-time SLA Compliance (<GUARANTEED_SLA_MS)
  const slaSamples = apiLogs.length > 0 ? apiLogs : killEvents;
  const slaWithinTargetCount = slaSamples.filter(item => (item.latencyMs ?? 0) <= GUARANTEED_SLA_MS).length;
  const slaCompliancePct = slaSamples.length > 0 ? (slaWithinTargetCount / slaSamples.length) * 100 : 100;
  const slaDashValue = Math.max(0, Math.min(100, Math.round(slaCompliancePct)));

  // Real-time Enterprise Context Engine parameters
  const standardLaborRate = laborConfig?.l1Rate ?? 35;
  const enabledPolicies = policies.filter(p => p.enabled);
  const blastRadiusLabel = bypassPolicyGuard
    ? 'Bypass Guard Active'
    : policies.length > 0 && enabledPolicies.length === 0
      ? 'No Active Policies'
      : enabledPolicies.some(p => p.category === 'security' || /strict|instant|halt/i.test(p.threshold || ''))
        ? 'Strict Enforcement'
        : `${enabledPolicies.length} Active Rules`;
  const blastRadiusIsWarning = bypassPolicyGuard || (policies.length > 0 && enabledPolicies.length === 0);

  const isSuperAdmin = currentUser?.role === 'SuperAdmin';

  // 30-Day Activity & Anomaly Heatmap calculations & state
  const { days: heatmapData, leadingEmptyDays } = React.useMemo(
    () => generate30DayHeatmapData(apiLogs, killEvents, driftEvents),
    [apiLogs, killEvents, driftEvents]
  );

  const [selectedHeatmapDateStr, setSelectedHeatmapDateStr] = React.useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = React.useState<'intensity' | 'anomalies'>('intensity');

  const activeDay = heatmapData.find(d => d.dateStr === selectedHeatmapDateStr) || heatmapData[heatmapData.length - 1];

  const total30DayRequests = heatmapData.reduce((acc, d) => acc + d.requests, 0);
  const total30DayAnomalies = heatmapData.reduce((acc, d) => acc + d.anomalies, 0);
  const compliantDaysCount = heatmapData.filter(d => d.anomalies === 0).length;
  const peakDay = heatmapData.reduce(
    (max, d) => (d.requests >= max.requests ? d : max),
    heatmapData[heatmapData.length - 1]
  );

  // Combine all live telemetry streams, sort newest-first, then display latest 5
  const recentActions = React.useMemo(() => {
    const killEntries = killEvents.map(e => ({
      type: 'SECURE' as const,
      title: 'Kill-Switch Intervention',
      desc: `${e.agentName || e.agentId || 'Agent'} was halted on '${e.actionCommand || 'action'}'`,
      time: e.timestamp,
      status: e.status || 'HALTED',
      badgeColor: 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30',
      id: e.id,
    }));

    const apiLogEntries = apiLogs
      .filter(l => {
        if (l.status !== 'HALTED') return true;
        const lTime = new Date(l.timestamp).getTime();
        const lId = (l.agentId || '').trim().toLowerCase();
        const lName = (l.agentName || '').trim().toLowerCase();
        return !killEvents.some(k => {
          const kTime = new Date(k.timestamp).getTime();
          const kAgent = (k.agentId || (k as any).agent_id || k.agentName || '').trim().toLowerCase();
          const sameAgent = !kAgent || kAgent === lId || kAgent === lName;
          return sameAgent && Math.abs(lTime - kTime) <= 5000;
        });
      })
      .map(l => ({
        type: 'SECURE' as const,
        title: l.status === 'HALTED' ? 'Gateway Intercept Halt' : 'Gateway Request Authorized',
        desc: `${l.agentName || l.agentId} verified on ${l.endpoint || '/v1/intercept'} (${Number(l.latencyMs || 0).toFixed(1)}ms)`,
        time: l.timestamp,
        status: l.status,
        badgeColor: l.status === 'HALTED'
          ? 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30'
          : 'bg-[#1D9E75]/12 text-[#1D9E75] border-[#1D9E75]/30',
        id: l.id,
      }));

    const driftFeedEntries = driftEvents
      .filter(e => !e.isTest && !(e as any).is_test && !(e as any).archived)
      .map(e => ({
        type: 'OBSERVE' as const,
        title: 'Cognitive Health Sentinel',
        desc: `${e.agentGroup || e.agentId || 'Agent'} shifted ${e.sentimentShiftPct}% from baseline (Health: ${e.cognitiveHealthScore}%)`,
        time: e.timestamp,
        status: e.status,
        badgeColor: e.status === 'CRITICAL'
          ? 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30'
          : e.status === 'WARNING'
            ? 'bg-[#EF9F27]/12 text-[#EF9F27] border-[#EF9F27]/30'
            : 'bg-[#1D9E75]/12 text-[#1D9E75] border-[#1D9E75]/30',
        id: e.id,
      }));

    const valueEntries = valueMetrics.map(e => ({
      type: 'MEASURE' as const,
      title: e.status === 'STABLE' ? 'AI Value Meter Sync' : 'AI Value Meter Alert',
      desc: e.status === 'STABLE'
        ? `${e.agentName} generated $${Number(e.humanLaborSaved || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} labor value (${e.roiScore.toFixed(1)}x ROI)`
        : `${e.agentName} ROI falls to ${e.roiScore.toFixed(1)}x`,
      time: e.timestamp,
      status: e.status,
      badgeColor: e.status === 'ALERT'
        ? 'bg-[#E24B4A]/12 text-[#E24B4A] border-[#E24B4A]/30'
        : e.status === 'WARNING'
          ? 'bg-[#EF9F27]/12 text-[#EF9F27] border-[#EF9F27]/30'
          : 'bg-[#1D9E75]/12 text-[#1D9E75] border-[#1D9E75]/30',
      id: e.id,
    }));

    return [...killEntries, ...apiLogEntries, ...driftFeedEntries, ...valueEntries]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [killEvents, apiLogs, driftEvents, valueMetrics]);

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Welcome Banner / Header */}
      <div className="p-8 rounded-2xl bg-[#111E2E] border border-[#1F2E40] shadow-lg relative overflow-hidden">
        {/* Abstract design elements matching the Navy & Teal palette */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#1D9E75]/5 rounded-full blur-3xl" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-[#1D9E75]/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 animate-fade-in-up">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold tracking-widest text-[#1D9E75] uppercase bg-[#1D9E75]/10 border border-[#1D9E75]/30 px-3 py-1 rounded-md">
                  UNIFIED GOVERNANCE LIFECYCLE (2026)
                </span>
                <button 
                  onClick={() => setGovernanceMode && setGovernanceMode(governanceMode === 'active' ? 'setup' : 'active')}
                  title="Click to toggle between Setup Mode and Active Governance Mode"
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded border uppercase font-bold tracking-wider cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                    governanceMode === 'active' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25' : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  }`}>
                  {governanceMode === 'active' ? '● Active Governance Mode' : '⚙ Setup Mode'}
                </button>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight text-[#F0EEE6] mt-3">
                Architecting the Guardrails of Autonomy
              </h1>
              <p className="text-[#8B9BAA] text-sm md:text-base max-w-2xl mt-2 leading-relaxed">
                AgentsGuardian orchestrates automated intent checking, ethical shift audits, and labor index value estimation 
                in a single self-healing, zero-trust container environment.
              </p>
            </div>

            {/* Header info */}
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
            <span className="text-xs font-mono text-[#F0EEE6] font-bold">{avgLatency}ms (&lt;{GUARANTEED_SLA_MS}ms Target)</span>
          </div>
          <div className="mt-1 pb-1 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline font-bold">
              Drill Down into Threat Simulator <ArrowUpRight size={12} />
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
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline font-bold">
              Drill Down into Cognitive Logs <ArrowUpRight size={12} />
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
            <span className={`text-xs font-mono font-bold ${netSavingsValue >= 0 ? 'text-[#1D9E75]' : 'text-[#E24B4A]'}`}>
              {netSavingsValue >= 0 ? '+$' : '-$'}{Math.abs(netSavingsValue).toLocaleString('en-US', { maximumFractionDigits: 0 })} SAVED
            </span>
          </div>
          <div className="mt-1 pb-1 flex justify-end">
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline font-bold">
              Drill Down into Economic Spend <ArrowUpRight size={12} />
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
            <span className="text-[10px] text-[#1D9E75] font-mono flex items-center gap-1 group-hover:underline font-bold">
              Drill Down into Gateway REST <ArrowUpRight size={12} />
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

      {/* Governed Agents Health Gauges Section */}
      <div className="bg-[#162030] rounded-xl border border-[#1F2E40] p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Gauge size={20} className="text-[#1D9E75]" />
              <h2 className="text-lg font-display font-bold text-[#F0EEE6]">
                Governed Agent Health Gauges
              </h2>
            </div>
            <p className="text-xs text-[#8B9BAA] mt-1">
              Real-time health scores calculated dynamically from the ratio of authorized versus halted/intercepted API requests.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('gaas')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            Manage Agents & Policies <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {governedAgents.length === 0 ? (
            <div className="col-span-full p-6 rounded-xl bg-[#0D1B2A] border border-[#1F2E40] text-center text-xs font-mono text-[#8B9BAA]">
              No governed agent instances connected yet. Register an agent in GaaS / APIs to monitor live health scores.
            </div>
          ) : governedAgents.map((agent) => {
            const health = computeAgentHealth(agent, apiLogs);
            const score = health.score;

            const statusBadge = getStatusBadge(
              score, 
              health.haltedCount > 0 || agent.status === 'HALTED', 
              agent.status === 'ALERT' || agent.status === 'MITIGATING'
            );

            // Gauge color themes based on statusBadge threshold
            let strokeColor = '#1D9E75'; // Teal
            let textColor = 'text-teal-400';
            let bgGlow = 'bg-teal-500/10 border-teal-500/20';

            if (statusBadge === 'HALT ALERT') {
              strokeColor = '#E24B4A'; // Red
              textColor = 'text-rose-400';
              bgGlow = 'bg-rose-500/10 border-rose-500/20';
            } else if (statusBadge === 'EVALUATING') {
              strokeColor = '#EF9F27'; // Amber
              textColor = 'text-amber-400';
              bgGlow = 'bg-amber-500/10 border-amber-500/20';
            }

            const radius = 32;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (circumference * score) / 100;

            const authRatioPct = health.totalLogs > 0 
              ? Math.round((health.authorizedCount / health.totalLogs) * 100) 
              : (agent.status === 'HALTED' ? 0 : 100);

            return (
              <div
                key={agent.id}
                onClick={() => onNavigateTab('gaas')}
                className="p-5 rounded-xl bg-[#0D1B2A] border border-[#1F2E40] hover:border-[#1D9E75]/40 transition-all duration-300 flex flex-col justify-between cursor-pointer group shadow-sm"
              >
                {/* Agent Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-[#162030] text-[#1D9E75] border border-[#1F2E40] shrink-0">
                        <Cpu size={15} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-display font-bold text-[#F0EEE6] truncate group-hover:text-teal-300 transition-colors">
                          {agent.name}
                        </h3>
                        <span className="text-[10px] font-mono text-[#8B9BAA]">
                          {agent.framework}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${bgGlow} shrink-0`}
                    >
                      {statusBadge}
                    </span>
                  </div>

                  {/* Circular Radial Gauge */}
                  <div className="my-4 flex items-center justify-center">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="#1F2E40"
                          strokeWidth="6"
                          fill="none"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke={strokeColor}
                          strokeWidth="6"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className={`text-2xl font-display font-bold ${textColor}`}>
                          {score}%
                        </span>
                        <span className="text-[8px] font-mono font-semibold tracking-wider text-[#8B9BAA] uppercase">
                          {statusBadge}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ratio bar */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#8B9BAA]">Authorized vs Halted Ratio</span>
                      <span className="text-[#F0EEE6] font-bold">
                        {health.authorizedCount} Auth / {health.haltedCount} Halted
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#162030] rounded-full overflow-hidden flex border border-[#1F2E40]">
                      <div
                        className="h-full bg-[#1D9E75] transition-all duration-500"
                        style={{ width: `${authRatioPct}%` }}
                        title={`Authorized: ${health.authorizedCount}`}
                      />
                      <div
                        className="h-full bg-[#E24B4A] transition-all duration-500"
                        style={{ width: `${100 - authRatioPct}%` }}
                        title={`Halted: ${health.haltedCount}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer details */}
                <div className="pt-3 border-t border-[#1F2E40] flex items-center justify-between text-[10px] font-mono text-[#8B9BAA]">
                  <span>Policy: <span className="text-teal-400 font-semibold">{agent.attachedPolicyCode}</span></span>
                  <span className="text-[10px] text-[#1D9E75] group-hover:underline flex items-center gap-0.5">
                    GaaS <ArrowUpRight size={10} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 30-Day Activity & Anomaly Heatmap Section */}
      <div className="bg-[#162030] rounded-xl border border-[#1F2E40] p-6 shadow-md space-y-6">
        {/* Header & Mode Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-[#1D9E75]" />
              <h2 className="text-lg font-display font-bold text-[#F0EEE6]">
                30-Day Execution Activity & Anomaly Heatmap
              </h2>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/30">
                30D Window
              </span>
            </div>
            <p className="text-xs text-[#8B9BAA] mt-1">
              Visualizing daily request execution density and policy interception anomaly spikes over the past 30 days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="bg-[#0D1B2A] p-1 rounded-lg border border-[#1F2E40] flex items-center gap-1 text-xs font-mono">
              <button
                onClick={() => setHeatmapMode('intensity')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  heatmapMode === 'intensity'
                    ? 'bg-[#1D9E75] text-white font-bold shadow'
                    : 'text-[#8B9BAA] hover:text-[#F0EEE6]'
                }`}
              >
                <Flame size={14} /> Activity Volume
              </button>
              <button
                onClick={() => setHeatmapMode('anomalies')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  heatmapMode === 'anomalies'
                    ? 'bg-[#E24B4A] text-white font-bold shadow'
                    : 'text-[#8B9BAA] hover:text-[#F0EEE6]'
                }`}
              >
                <AlertTriangle size={14} /> Anomaly Frequency
              </button>
            </div>
          </div>
        </div>

        {/* 30-Day Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1B2A] p-4 rounded-lg border border-[#1F2E40] text-xs font-mono">
          <div>
            <span className="text-[#8B9BAA] block text-[11px]">30D Total Execution</span>
            <span className="text-base font-display font-bold text-[#F0EEE6] mt-0.5 block">
              {total30DayRequests.toLocaleString()} reqs
            </span>
          </div>
          <div>
            <span className="text-[#8B9BAA] block text-[11px]">30D Interceptions</span>
            <span className={`text-base font-display font-bold mt-0.5 block ${total30DayAnomalies > 0 ? 'text-[#E24B4A]' : 'text-emerald-400'}`}>
              {total30DayAnomalies} events
            </span>
          </div>
          <div>
            <span className="text-[#8B9BAA] block text-[11px]">Policy Compliance Rate</span>
            <span className="text-base font-display font-bold text-[#1D9E75] mt-0.5 block">
              {Math.round((compliantDaysCount / 30) * 100)}% ({compliantDaysCount}/30 Days)
            </span>
          </div>
          <div>
            <span className="text-[#8B9BAA] block text-[11px]">Peak Activity Date</span>
            <span className="text-base font-display font-bold text-amber-400 mt-0.5 block">
              {peakDay.formattedDate} ({peakDay.requests} reqs)
            </span>
          </div>
        </div>

        {/* Heatmap Grid & Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Heatmap Grid (7 Columns) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-mono font-bold text-[#8B9BAA] pb-1 border-b border-[#1F2E40]">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
                <div key={`empty-${idx}`} aria-hidden="true" />
              ))}
              {heatmapData.map((day) => {
                const isSelected = activeDay.dateStr === day.dateStr;

                // Color calculation depending on heatmapMode
                let bgClass = 'bg-[#0D1B2A] border-[#1F2E40] text-[#8B9BAA]';

                if (heatmapMode === 'intensity') {
                  if (day.intensity === 1) bgClass = 'bg-[#0E382C] border-emerald-800/40 text-emerald-200';
                  else if (day.intensity === 2) bgClass = 'bg-[#125E48] border-emerald-700/60 text-emerald-100';
                  else if (day.intensity === 3) bgClass = 'bg-[#1B8A68] border-emerald-500/70 text-white font-semibold';
                  else if (day.intensity === 4) bgClass = 'bg-[#1D9E75] border-teal-300 text-white font-bold shadow-[0_0_8px_rgba(29,158,117,0.4)]';
                } else {
                  if (day.anomalies === 0) bgClass = 'bg-[#0F211C] border-emerald-900/40 text-emerald-400';
                  else if (day.anomalies <= 2) bgClass = 'bg-[#4D330E] border-amber-500/50 text-amber-200 font-semibold';
                  else bgClass = 'bg-[#6B1D1D] border-rose-500/60 text-rose-100 font-bold shadow-[0_0_8px_rgba(226,75,74,0.4)]';
                }

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedHeatmapDateStr(day.dateStr)}
                    className={`
                      relative p-2 rounded-lg border flex flex-col items-center justify-between h-16 transition-all duration-200 cursor-pointer group text-left
                      ${bgClass}
                      ${isSelected ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#162030] scale-105 z-10' : 'hover:scale-102 hover:border-teal-400/50'}
                    `}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] font-mono opacity-80">{day.formattedDate}</span>
                      {day.anomalies > 0 && (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                          title={`${day.anomalies} anomaly events`}
                        />
                      )}
                    </div>
                    
                    <div className="w-full text-center my-0.5">
                      <span className="text-sm font-display font-bold block leading-none">
                        {heatmapMode === 'intensity' ? day.requests : day.anomalies}
                      </span>
                      <span className="text-[9px] font-mono opacity-75 uppercase">
                        {heatmapMode === 'intensity' ? 'reqs' : 'halts'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-[11px] font-mono text-[#8B9BAA]">
              <div className="flex items-center gap-2">
                <span>Less Activity</span>
                <div className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 rounded bg-[#0D1B2A] border border-[#1F2E40]" />
                  <span className="w-3.5 h-3.5 rounded bg-[#0E382C] border border-emerald-800/40" />
                  <span className="w-3.5 h-3.5 rounded bg-[#125E48] border border-emerald-700/60" />
                  <span className="w-3.5 h-3.5 rounded bg-[#1B8A68] border border-emerald-500/70" />
                  <span className="w-3.5 h-3.5 rounded bg-[#1D9E75] border border-teal-300" />
                </div>
                <span>Peak Activity</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span>Interception Anomaly Triggered</span>
              </div>
            </div>
          </div>

          {/* Inspected Day Detail Card */}
          <div className="lg:col-span-4 bg-[#0D1B2A] p-5 rounded-xl border border-[#1F2E40] space-y-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-[#1F2E40] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#1D9E75] font-bold uppercase tracking-wider block">
                  INSPECTED DAY TELEMETRY
                </span>
                <h3 className="text-sm font-display font-bold text-[#F0EEE6] mt-0.5">
                  {activeDay.fullDay}
                </h3>
              </div>
              <span
                className={`text-[9px] font-mono font-bold uppercase px-2.5 py-1 rounded border ${
                  activeDay.anomalies > 2
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : activeDay.anomalies > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {activeDay.dominantStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-[#162030] border border-[#1F2E40]">
                <span className="text-[10px] text-[#8B9BAA] block">Executed Requests</span>
                <span className="text-base font-bold text-[#F0EEE6] mt-1 block">
                  {activeDay.requests} calls
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#162030] border border-[#1F2E40]">
                <span className="text-[10px] text-[#8B9BAA] block">Policy Intercepts</span>
                <span className={`text-base font-bold mt-1 block ${activeDay.anomalies > 0 ? 'text-[#E24B4A]' : 'text-emerald-400'}`}>
                  {activeDay.anomalies} events
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#162030] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">Dominant Agent:</span>
                <span className="text-teal-300 font-bold">{activeDay.primaryAgent}</span>
              </div>

              <div className="p-3 rounded bg-[#162030] border border-[#1F2E40] space-y-1.5">
                <span className="text-[11px] font-bold text-[#F0EEE6] block">Day Summary Highlights:</span>
                <ul className="space-y-1 text-[11px] text-[#8B9BAA] list-disc list-inside">
                  {activeDay.keyEventsSummary.map((event, idx) => (
                    <li key={idx}>{event}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('secure')}
              className="w-full py-2 px-3 rounded-lg bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-2"
            >
              Inspect Intercept Logs in Sentinel <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>

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
            {recentActions.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-center text-xs font-mono text-[#8B9BAA]">
                No real-time telemetry events recorded yet. Live gateway intercepts and sentinel alerts will appear here automatically.
              </div>
            ) : recentActions.map((event, index) => (
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
                      {formatTimestamp(event.time)}
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
                <span className={`${restConnectionStatus === 'DISCONNECTED' ? 'text-[#E24B4A]' : restConnectionStatus === 'DEGRADED' ? 'text-[#EF9F27]' : 'text-[#1D9E75]'} font-semibold flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 ${restConnectionStatus === 'DISCONNECTED' ? 'bg-[#E24B4A]' : restConnectionStatus === 'DEGRADED' ? 'bg-[#EF9F27]' : 'bg-[#1D9E75]'} rounded-full animate-pulse`} /> {restConnectionStatus}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">Standard Labor Rate Mapping</span>
                <span className="text-[#F0EEE6] font-bold">${standardLaborRate.toFixed(2)} / Human-Hour</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">CISO Blast Radius Parameters</span>
                <span className={`${blastRadiusIsWarning ? 'text-[#EF9F27]' : 'text-[#1D9E75]'} font-bold uppercase`}>{blastRadiusLabel}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-[#0D1B2A] border border-[#1F2E40]">
                <span className="text-[#8B9BAA]">Total API Audited Requests</span>
                <span className="text-[#F0EEE6] font-bold">{totalRequests.toLocaleString('en-US')} intercepted</span>
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
                    strokeDasharray={`${slaDashValue}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-display leading-none">
                  <span className="text-lg font-bold text-[#F0EEE6]">{slaCompliancePct.toFixed(1)}%</span>
                  <span className="text-[8px] text-[#556070] font-mono tracking-wide mt-1">LATENCY SAFE</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-display font-semibold text-[#F0EEE6] text-sm">Deterministic Gateways</h4>
                <p className="text-xs text-[#8B9BAA] leading-relaxed">
                  {slaCompliancePct.toFixed(1)}% of headless script executions check policies and halt in **&lt;{GUARANTEED_SLA_MS}ms Target** to prevent payload write breaches.
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#1D9E75] font-mono">
                  <CheckCircle2 size={12} /> EU AI Act Art. 12 & Annex IV Compliant Ledger Enabled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
