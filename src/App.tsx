/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import SecurePillar from './components/SecurePillar';
import ObservePillar from './components/ObservePillar';
import MeasurePillar from './components/MeasurePillar';
import PolicyConfig from './components/PolicyConfig';
import GaaSApiPillar from './components/GaaSApiPillar';
import AdminPillar from './components/AdminPillar';
import HelpCenter from './components/HelpCenter';
import ToastNotifier from './components/ToastNotifier';
import GaaSAccessGate from './components/GaaSAccessGate';
import { Sliders, Palette, ChevronDown, Check, LogOut } from 'lucide-react';

import { Policy, KillSignalEvent, DriftLogEvent, ValueMeterMetric, GoverningAgent, ApiRequestLog, Toast, AdminUser } from './types';
import { 
  INITIAL_POLICIES, 
  INITIAL_KILL_SWITCH_EVENTS, 
  INITIAL_DRIFT_EVENTS, 
  INITIAL_VALUE_METRICS,
  INITIAL_ADMINS
} from './data';

const INITIAL_GOVERNED_AGENTS: GoverningAgent[] = [
  { id: 'GA-101', name: 'SalesSummarizer-CrewAI', framework: 'CrewAI', webhookUrl: 'https://internal-workflow.org/hooks/sales-bot', attachedPolicyCode: 'POL-SEC-01', status: 'NOMINAL', requestCount: 394 },
  { id: 'GA-102', name: 'AutoTrader-Langchain', framework: 'LangChain', webhookUrl: 'https://trading-node-2.net/gaas/gate', attachedPolicyCode: 'POL-FIN-01', status: 'NOMINAL', requestCount: 1242 },
  { id: 'GA-103', name: 'AutoGen-TriageHQ', framework: 'AutoGen', webhookUrl: 'https://conversation.firm.com/api/v1', attachedPolicyCode: 'POL-ETH-01', status: 'NOMINAL', requestCount: 8905 }
];

const INITIAL_API_LOGS: ApiRequestLog[] = [
  {
    id: 'REQ-94812',
    timestamp: new Date(Date.now() - 40000).toISOString(),
    agentId: 'GA-103',
    agentName: 'AutoGen-TriageHQ',
    endpoint: '/v1/intercept',
    status: 'AUTHORIZED',
    latencyMs: 24
  },
  {
    id: 'REQ-94801',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    agentId: 'GA-102',
    agentName: 'AutoTrader-Langchain',
    endpoint: '/v1/intercept',
    status: 'AUTHORIZED',
    latencyMs: 31
  },
  {
    id: 'REQ-94775',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    agentId: 'GA-101',
    agentName: 'SalesSummarizer-CrewAI',
    endpoint: '/v1/intercept',
    status: 'HALTED',
    latencyMs: 42
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Theme state and selector options
  const [activeTheme, setActiveTheme] = useState<string>('emerald');
  const [activeBg, setActiveBg] = useState<string>('charcoal');
  const [showAppearanceMenu, setShowAppearanceMenu] = useState<boolean>(false);

  const themeOptions = useMemo(() => [
    { id: 'emerald', name: 'Emerald Sentinel', primary: '#1D9E75', rgb: '29, 158, 117', dark: '#0F6E56' },
    { id: 'cyber', name: 'Cyber Neon Cyan', primary: '#06b6d4', rgb: '6, 182, 212', dark: '#0891b2' },
    { id: 'solar', name: 'Amber Solar Core', primary: '#EF9F27', rgb: '239, 159, 39', dark: '#b45309' },
    { id: 'cobalt', name: 'Cobalt Shield', primary: '#3b82f6', rgb: '59, 130, 246', dark: '#1d4ed8' },
    { id: 'purple', name: 'Sovereign Violet', primary: '#a855f7', rgb: '168, 85, 247', dark: '#7e22ce' },
    { id: 'rose', name: 'Rose Red Vigil', primary: '#f43f5e', rgb: '244, 63, 94', dark: '#be123c' }
  ], []);

  const bgOptions = useMemo(() => [
    { id: 'charcoal', name: 'Cyber Charcoal', primary: '#090e17', cardBg: '#111e2e', border: '#1f2e40', primaryRgb: '17, 30, 46' },
    { id: 'obsidian', name: 'Pitch Obsidian', primary: '#030303', cardBg: '#09090c', border: '#17171d', primaryRgb: '9, 9, 12' },
    { id: 'carbon', name: 'Carbon Jet', primary: '#0e0f12', cardBg: '#15171c', border: '#252932', primaryRgb: '21, 23, 28' },
    { id: 'forest', name: 'Forest Shadow', primary: '#040806', cardBg: '#09120e', border: '#13241b', primaryRgb: '9, 18, 14' }
  ], []);

  useEffect(() => {
    const selected = themeOptions.find(t => t.id === activeTheme) || themeOptions[0];
    const selectedBg = bgOptions.find(b => b.id === activeBg) || bgOptions[0];

    let styleEl = document.getElementById('dynamic-theme-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('id', 'dynamic-theme-overrides');
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      :root {
        --theme-primary: ${selected.primary} !important;
        --theme-primary-rgb: ${selected.rgb} !important;
        --theme-primary-dark: ${selected.dark} !important;
        --color-brand-teal: ${selected.primary} !important;
        --color-brand-teal-dark: ${selected.dark} !important;
      }

      /* Dynamically override application container backgrounds */
      body, .min-h-screen, html, #root {
        background-color: ${selectedBg.primary} !important;
      }

      /* Dynamically override card and panel backgrounds to matchselectedBg */
      .bg-\\[\\#162030\\], .bg-\\[\\#111E2E\\], .bg-\\[\\#09090B\\], .bg-\\[\\#0d1b2a\\], .bg-zinc-950, .bg-\\[\\#0D1B2A\\], .bg-\\[\\#1E1214\\] {
        background-color: ${selectedBg.cardBg} !important;
      }

      /* Dynamically override border lines to match selectedBg */
      .border-\\[\\#1F2E40\\], .border-zinc-900, .border-zinc-850, .border-zinc-800, .border-zinc-700 {
        border-color: ${selectedBg.border} !important;
      }

      /* Base overrides for tailwind color values */
      .text-\\[\\#1D9E75\\] { color: ${selected.primary} !important; }
      .bg-\\[\\#1D9E75\\] { background-color: ${selected.primary} !important; }
      .border-\\[\\#1D9E75\\] { border-color: ${selected.primary} !important; }

      /* Alpha transparency class variations */
      .bg-\\[\\#1D9E75\\]\\/5 { background-color: rgba(${selected.rgb}, 0.05) !important; }
      .bg-\\[\\#1D9E75\\]\\/10 { background-color: rgba(${selected.rgb}, 0.1) !important; }
      .bg-\\[\\#1D9E75\\]\\/15 { background-color: rgba(${selected.rgb}, 0.15) !important; }
      .bg-\\[\\#1D9E75\\]\\/20 { background-color: rgba(${selected.rgb}, 0.2) !important; }
      .bg-\\[\\#1D9E75\\]\\/25 { background-color: rgba(${selected.rgb}, 0.25) !important; }

      .border-\\[\\#1D9E75\\]\\/20 { border-color: rgba(${selected.rgb}, 0.2) !important; }
      .border-\\[\\#1D9E75\\]\\/25 { border-color: rgba(${selected.rgb}, 0.25) !important; }
      .border-\\[\\#1D9E75\\]\\/30 { border-color: rgba(${selected.rgb}, 0.3) !important; }
      .border-\\[\\#1D9E75\\]\\/35 { border-color: rgba(${selected.rgb}, 0.35) !important; }
      .border-\\[\\#1D9E75\\]\\/50 { border-color: rgba(${selected.rgb}, 0.5) !important; }

      /* Standard SVG logo fills and strokes */
      path[fill="#1D9E75"] { fill: ${selected.primary} !important; }
      path[stroke="#0F6E56"] { stroke: ${selected.dark} !important; }

      /* Text highlight selectors */
      .text-teal-400 { color: ${selected.primary} !important; }
      .text-teal-450 { color: ${selected.primary} !important; }
      .text-emerald-400 { color: ${selected.primary} !important; }

      /* Background highlight selectors */
      .bg-teal-500\\/10 { background-color: rgba(${selected.rgb}, 0.1) !important; }
      .bg-teal-500\\/15 { background-color: rgba(${selected.rgb}, 0.15) !important; }
      .border-teal-500\\/20 { border-color: rgba(${selected.rgb}, 0.2) !important; }
      .border-teal-500\\/25 { border-color: rgba(${selected.rgb}, 0.25) !important; }
      .bg-teal-550\\/10 { background-color: rgba(${selected.rgb}, 0.1) !important; }
      .border-teal-500\\/25 { border-color: rgba(${selected.rgb}, 0.25) !important; }

      /* Charts stroke & fills */
      .stroke-\\[\\#1D9E75\\] { stroke: ${selected.primary} !important; }
      .fill-\\[\\#1D9E75\\] { fill: ${selected.primary} !important; }

      /* Custom system states */
      ::selection { background-color: rgba(${selected.rgb}, 0.28) !important; }
      ::-webkit-scrollbar-thumb:hover { background: ${selected.primary} !important; }

      /* Live active state animation blocks */
      .animate-ping { background-color: ${selected.primary} !important; }
    `;
  }, [activeTheme, themeOptions, activeBg, bgOptions]);

  // Data management states
  const [policies, setPolicies] = useState<Policy[]>(INITIAL_POLICIES);
  const [killEvents, setKillEvents] = useState<KillSignalEvent[]>(INITIAL_KILL_SWITCH_EVENTS);
  const [driftEvents, setDriftEvents] = useState<DriftLogEvent[]>(INITIAL_DRIFT_EVENTS);
  const [valueMetrics, setValueMetrics] = useState<ValueMeterMetric[]>(INITIAL_VALUE_METRICS);
  const [budgetCap, setBudgetCap] = useState<number>(50); // Standard $50.00 Limit initial value

  // Lifted Identity States
  const [users, setUsers] = useState<AdminUser[]>(() => {
    const saved = localStorage.getItem('gaas_captured_people_v1');
    return saved ? JSON.parse(saved) : INITIAL_ADMINS;
  });

  const [actingUserId, setActingUserId] = useState<string>(() => {
    return localStorage.getItem('gaas_logged_in_user_id') || 'USR-000';
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('gaas_is_logged_in') === 'true';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('gaas_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('gaas_sidebar_collapsed', newVal ? 'true' : 'false');
      return newVal;
    });
  };
  
  const currentUser = useMemo(() => {
    return users.find(u => u.id === actingUserId) || users[0] || INITIAL_ADMINS[0];
  }, [users, actingUserId]);

  const setCurrentUser = (selectedVal: AdminUser) => {
    setActingUserId(selectedVal.id);
    localStorage.setItem('gaas_logged_in_user_id', selectedVal.id);
  };

  const handleRegisterUser = (newUser: AdminUser) => {
    setUsers(prev => {
      const updated = [...prev, newUser];
      localStorage.setItem('gaas_captured_people_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setActingUserId(user.id);
    setIsLoggedIn(true);
    localStorage.setItem('gaas_is_logged_in', 'true');
    localStorage.setItem('gaas_logged_in_user_id', user.id);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('gaas_is_logged_in', 'false');
    setShowAppearanceMenu(false);
  };

  useEffect(() => {
    localStorage.setItem('gaas_captured_people_v1', JSON.stringify(users));
  }, [users]);

  // Uplifted GaaS API States
  const [governedAgents, setGovernedAgents] = useState<GoverningAgent[]>(INITIAL_GOVERNED_AGENTS);
  const [apiLogs, setApiLogs] = useState<ApiRequestLog[]>(INITIAL_API_LOGS);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | 'off'>(30000);
  const [latencyThreshold, setLatencyThreshold] = useState<number>(35);

  // Toast notification states
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [disableAlertsGlobally, setDisableAlertsGlobally] = useState<boolean>(false);

  const disableAlertsRef = React.useRef(disableAlertsGlobally);
  disableAlertsRef.current = disableAlertsGlobally;

  const addToast = (t: Omit<Toast, 'id' | 'timestamp'>) => {
    // If alerts are globally disabled, suppress background warnings and danger alerts (e.g., SLA breaches, kill switches)
    const isMuteOrRestoreToast = t.title.includes('Notifications Muted') || t.title.includes('Notifications Restored');
    if (disableAlertsRef.current && (t.type === 'danger' || t.type === 'warning') && !isMuteOrRestoreToast) {
      console.log(`[Alert Suppressed] ${t.title}: ${t.message}`);
      return;
    }
    const newToast: Toast = {
      ...t,
      id: `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };
    setToasts(prev => [newToast, ...prev]);
  };

  const handleRemoveToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Live Auto-Refresh GaaS Background Api Transaction logs and SLA monitor
  useEffect(() => {
    if (!isLoggedIn || autoRefreshInterval === 'off') return;

    const intervalId = setInterval(() => {
      setGovernedAgents(prevAgents => {
        if (prevAgents.length === 0) return prevAgents;
        const randomAgentIndex = Math.floor(Math.random() * prevAgents.length);
        const agent = prevAgents[randomAgentIndex];

        const endpoints = ['/v1/intercept', '/v1/intercept', '/v1/token/validate', '/v1/policy/evaluate'];
        const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        // 90% AUTHORIZED, 10% HALTED
        const status = Math.random() > 0.10 ? 'AUTHORIZED' : 'HALTED';
        // Wider latency range up to 450ms makes the SLA limit simulator highly interactive
        const latencyMs = Math.floor(Math.random() * 420) + 12;

        const newLog: ApiRequestLog = {
          id: `REQ-${Math.floor(Math.random() * 90000) + 10000}`,
          timestamp: new Date().toISOString(),
          agentId: agent.id,
          agentName: agent.name,
          endpoint: randomEndpoint,
          status: status as 'AUTHORIZED' | 'HALTED',
          latencyMs
        };

        setApiLogs(prev => [newLog, ...prev.slice(0, 19)]);

        // 1. SLA Latency Breach Check
        if (latencyMs > latencyThreshold) {
          addToast({
            type: 'warning',
            title: `⚠️ SLA Latency Limit Breached`,
            message: `Gateway API Intercept responded in ${latencyMs}ms (Threshold SLA: ${latencyThreshold}ms).\nAffected Node: ${agent.name}`,
            duration: 5000
          });
        }

        // 2. Kill Switch / Halted state check in Background live-traffic
        if (status === 'HALTED') {
          const newHaltEvent: KillSignalEvent = {
            id: `KG-GaaS-${Math.floor(Math.random() * 90) + 10}`,
            timestamp: new Date().toISOString(),
            agentName: agent.name,
            actionCommand: 'Intercepted anomalous command thread',
            interceptedPacket: `POST ${randomEndpoint} [GaaS API Live]`,
            policyViolated: 'POL-SEC-01 (Security Shield Protocol)',
            latencyMs: latencyMs,
            status: 'HALTED',
            rawJsonIntent: '{"anomaly": "Background script evaluated illegal system execution parameters"}',
            timestampAnnexV: `20260609-${new Date().getTime().toString().substring(5)}-GAAS`
          };

          // Timeout avoids calling handleTriggerKillEvent inside GaaS state dispatch loop
          setTimeout(() => {
            handleTriggerKillEvent(newHaltEvent);
          }, 0);
        }

        return prevAgents.map(a => 
          a.id === agent.id 
            ? { 
                ...a, 
                requestCount: a.requestCount + 1,
                status: status === 'HALTED' ? 'ALERT' : a.status === 'ALERT' ? 'NOMINAL' : a.status
              } 
            : a
        );
      });
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, latencyThreshold, isLoggedIn]);


  // Computed state calculations
  const avgLatency = useMemo(() => {
    if (killEvents.length === 0) return 0;
    const total = killEvents.reduce((acc, curr) => acc + curr.latencyMs, 0);
    return Math.round(total / killEvents.length);
  }, [killEvents]);

  const overallCognitiveHealth = useMemo(() => {
    if (driftEvents.length === 0) return 100;
    const total = driftEvents.reduce((acc, curr) => acc + curr.cognitiveHealthScore, 0);
    return Math.round(total / driftEvents.length);
  }, [driftEvents]);

  const overallRoi = useMemo(() => {
    const totalSpend = valueMetrics.reduce((acc, m) => acc + m.totalApiSpend, 0);
    const totalLaborSaved = valueMetrics.reduce((acc, m) => acc + m.humanLaborSaved, 0);
    return totalSpend > 0 ? totalLaborSaved / totalSpend : 0;
  }, [valueMetrics]);

  // Handler functions
  const handleTriggerKillEvent = (newEvent: KillSignalEvent) => {
    setKillEvents(prev => [newEvent, ...prev]);
    addToast({
      type: 'danger',
      title: '🚨 Kill Switch Activated',
      message: `Emergency Intercept block initiated for governed agent node "${newEvent.agentName}". Action command "${newEvent.actionCommand}" has been halted.`,
      duration: 7000
    });
  };

  const handleClearKillLogs = () => {
    setKillEvents([]);
  };

  const handleRemediateDrift = (id: string) => {
    setDriftEvents(prev => prev.map(event => {
      if (event.id === id) {
        addToast({
          type: 'success',
          title: 'Ethical Deviation Remediated',
          message: `Successfully recalibrated standards alignment for event [${id}] (Cognitive health restored).`
        });
        return {
          ...event,
          status: 'NORMAL',
          cognitiveHealthScore: Math.min(event.cognitiveHealthScore + 15, 100),
          sentimentShiftPct: Math.max(event.sentimentShiftPct - 10, 2.5),
          remedatedAt: new Date().toISOString()
        };
      }
      return event;
    }));
  };

  const handleAddDriftEvent = (newEvent: DriftLogEvent) => {
    setDriftEvents(prev => [newEvent, ...prev]);
  };

  const handleAddMetricEvent = (newMetric: ValueMeterMetric) => {
    setValueMetrics(prev => [newMetric, ...prev]);
  };

  const handleRefineAgent = (id: string) => {
    setValueMetrics(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: 'STABLE',
          totalApiSpend: Math.max(m.totalApiSpend - 40, 10), // Adjust bloated context cost downward
          roiScore: m.humanLaborSaved / Math.max(m.totalApiSpend - 40, 10)
        };
      }
      return m;
    }));
  };

  const handleTogglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => {
      if (p.id === id) {
        const nextEnabled = !p.enabled;
        addToast({
          type: nextEnabled ? 'success' : 'warning',
          title: nextEnabled ? 'Governance Policy Rule Active' : 'Governance Policy Rule Deactivated',
          message: `Policy rule "${p.name}" has been successfully ${nextEnabled ? 'enabled' : 'disabled & bypassed'}.`
        });
        return { ...p, enabled: nextEnabled };
      }
      return p;
    }));
  };

  const handleAddPolicy = (newPolicy: Policy) => {
    setPolicies(prev => [...prev, newPolicy]);
    addToast({
      type: 'success',
      title: 'Governance Policy Registered',
      message: `Successfully provisioned new policy: "${newPolicy.name}" under category: ${newPolicy.category}.`
    });
  };

  const handleDeletePolicy = (id: string) => {
    let deletedName = "Policy Rule";
    setPolicies(prev => {
      const match = prev.find(p => p.id === id);
      if (match) deletedName = match.name;
      return prev.filter(p => p.id !== id);
    });
    addToast({
      type: 'danger',
      title: 'Governance Policy Deleted',
      message: `Permanently removed and unlinked policy rule: "${deletedName}".`
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#07090F]">
        <GaaSAccessGate 
          users={users}
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
          addToast={addToast}
        />
        <ToastNotifier toasts={toasts} onRemoveToast={handleRemoveToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 font-sans flex flex-col lg:flex-row antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Sidebar navigation panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        policiesCount={policies.length}
        haltedCount={killEvents.filter(e => e.status === 'HALTED').length}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        addToast={addToast}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main content display window */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6 h-screen select-none">
        
        {/* Top Global Administrative Banner - Fixed style with top-right session profile */}
        <div className="bg-[#111E2E] border border-[#1F2E40] rounded-xl px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md bg-opacity-95 backdrop-blur-md transition-all duration-300 relative z-50">
          {/* Left Gateway Route status */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[--theme-primary] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[--theme-primary]"></span>
            </span>
            <div className="text-[11px] font-mono tracking-wider text-zinc-400">
              GATEWAY TUNNEL: <strong className="text-[--theme-primary] uppercase font-black">{activeTab} // MULTI-AGENT SHIELD</strong>
            </div>
          </div>

          {/* Top Right: Active security session dropdown click trigger */}
          <div className="relative shrink-0 z-20">
            <button
              onClick={() => setShowAppearanceMenu(!showAppearanceMenu)}
              className="flex items-center gap-3 bg-black/40 px-3.5 py-1.5 rounded-lg border border-[#1F2E40] hover:border-[--theme-primary]/40 transition-all shadow-inner text-left cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2 flex-row">
                <div className="relative">
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-black animate-pulse" />
                  <div className="h-7 w-7 rounded-md bg-[--theme-primary]/15 border border-[--theme-primary]/30 flex items-center justify-center font-mono text-xs font-black text-[--theme-primary]">
                    {currentUser.name.substring(0,2).toUpperCase()}
                  </div>
                </div>
                <div className="leading-none pr-1.5">
                  <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase block mb-1 font-bold group-hover:text-zinc-400 transition-colors">
                    SECURE ACTIVE SESSION
                  </span>
                  <span className="text-[11px] font-sans font-bold text-slate-100 group-hover:text-[--theme-primary] transition-colors">
                    {currentUser.name} ({currentUser.role})
                  </span>
                </div>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-250 ${showAppearanceMenu ? 'rotate-180 text-[--theme-primary]' : ''}`} />
              </div>
            </button>

            {/* Custom Interactive Profile & Personalization Sub-Menu Popup */}
            {showAppearanceMenu && (
              <>
                {/* Click outside overlay to close the window overlay */}
                <div 
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setShowAppearanceMenu(false)}
                />
                <div className="absolute right-0 mt-2.5 w-80 bg-[#111E2E] border border-[#1F2E40] rounded-xl shadow-2xl p-4 z-40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Account detail header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-[#1F2E40]/60">
                    <div className="h-9 w-9 rounded-md bg-[--theme-primary]/15 border border-[--theme-primary]/30 flex items-center justify-center font-mono text-xs font-black text-[--theme-primary]">
                      {currentUser.name.substring(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase block font-black leading-none mb-1">
                        Active Administrator
                      </span>
                      <h4 className="text-xs font-bold text-slate-105 truncate">{currentUser.name}</h4>
                      <p className="text-[9px] font-mono text-zinc-400 truncate mb-1.5">{currentUser.email}</p>
                      <span className="text-[9px] text-[--theme-primary] font-mono uppercase bg-[--theme-primary]/10 px-1.5 py-0.5 rounded border border-[--theme-primary]/25">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  {/* Tenant Identity Isolation & Switch Session Controller */}
                  {currentUser.role === 'SuperAdmin' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-[#8B9BAA] font-bold uppercase tracking-widest block font-mono">
                          Switch Active Identity
                        </label>
                        <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded font-mono">
                          SuperAdmin Privilege
                        </span>
                      </div>
                      <select
                        value={currentUser.id}
                        onChange={(e) => {
                          const selected = users.find(u => u.id === e.target.value);
                          if (selected) {
                            if (selected.status === 'SUSPENDED') {
                              addToast({
                                type: 'danger',
                                title: '❌ Authentication Error',
                                message: `Administrative account for "${selected.name}" is currently SUSPENDED. Access token generation halted.`,
                                duration: 6000
                              });
                              return;
                            }
                            setCurrentUser(selected);
                            addToast({
                              type: 'success',
                              title: '🔐 Active Session Swapped',
                              message: `Successfully authenticated as: ${selected.name} (${selected.role}). Gateway encryption tokens recompiled.`
                            });
                          }
                        }}
                        className="w-full text-xs font-sans font-bold bg-black/60 border border-[#1F2E40] rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-[--theme-primary] hover:border-zinc-700 transition-colors cursor-pointer"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id} className="bg-[#111E2E] text-xs text-slate-300">
                            {u.email === 'mritunjoysingh@gmail.com' ? '👑 ' : u.role === 'SuperAdmin' ? '💎 ' : '👤 '} 
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-mono font-bold uppercase tracking-wider text-teal-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                          Tenant Isolation Active
                        </span>
                        <span className="text-[8px] bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded text-teal-300">
                          LOCKED
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                        Dedicated customer instance locked to <strong className="text-white">{currentUser.name}</strong>. Global identity switching and SuperAdmin impersonation are restricted by security policy.
                      </p>
                    </div>
                  )}

                  {/* System Theme Accent Color Picker */}
                  <div className="space-y-2 pt-3 border-t border-[#1F2E40]/50">
                    <div className="flex items-center gap-1.5 font-mono select-none">
                      <Sliders size={12} className="text-[--theme-primary]" />
                      <span className="text-[9px] text-[#8B9BAA] font-bold uppercase tracking-widest block font-bold">
                        System Theme Accent
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                      {themeOptions.map((theme) => (
                        <button
                          key={theme.id}
                          title={theme.name}
                          onClick={() => {
                            setActiveTheme(theme.id);
                            addToast({
                              type: 'success',
                              title: '🎨 Style Palette Applied',
                              message: `Sovereign Gateway color space recalibrated to "${theme.name}". Active styles hot-swapped.`
                            });
                          }}
                          className={`h-5.5 w-full rounded border flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                            activeTheme === theme.id 
                              ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.15)] bg-slate-100/10' 
                              : 'border-zinc-800 hover:border-zinc-700 bg-black/20'
                          }`}
                        >
                          <span 
                            className="w-3 h-3 rounded-full inline-block" 
                            style={{ backgroundColor: theme.primary }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* App Background options picker */}
                  <div className="space-y-2 pt-3 border-t border-[#1F2E40]/50">
                    <div className="flex items-center gap-1.5 font-mono select-none">
                      <Palette size={12} className="text-[--theme-primary]" />
                      <span className="text-[9px] text-[#8B9BAA] font-bold uppercase tracking-widest block font-bold">
                        App Background Color
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {bgOptions.map((bg) => (
                        <button
                          key={bg.id}
                          title={bg.name}
                          onClick={() => {
                            setActiveBg(bg.id);
                            addToast({
                              type: 'success',
                              title: '🎬 Background Restyled',
                              message: `Display environment remapped to ${bg.name} theme.`
                            });
                          }}
                          className={`h-7.5 px-2 rounded border flex items-center justify-between transition-all cursor-pointer hover:scale-102 active:scale-98 text-[9px] font-mono leading-none ${
                            activeBg === bg.id 
                              ? 'border-[--theme-primary] bg-black/60 font-black text-white shadow-md' 
                              : 'border-zinc-850 hover:border-zinc-700 bg-black/10 text-zinc-550'
                          }`}
                          style={{ backgroundColor: bg.cardBg }}
                        >
                          <span>{bg.name.split(' ')[0]}</span>
                          {activeBg === bg.id && <Check size={10} className="text-[--theme-primary]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active theme code designation */}
                  <div className="text-[9.5px] text-zinc-500 font-mono flex justify-between items-center select-none pt-2 border-t border-[#1F2E40]/50">
                    <span>Active Theme:</span>
                    <span className="text-zinc-300 font-bold uppercase tracking-wider">
                      {themeOptions.find(t => t.id === activeTheme)?.name.split(' ')[0]}
                    </span>
                  </div>

                  {/* Sign Out Trigger Button */}
                  <div className="pt-2 border-t border-[#1F2E40]/55">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-400 text-[10.5px] font-mono font-bold rounded-lg transition-all cursor-pointer transform active:scale-98"
                      type="button"
                    >
                      <LogOut size={12} className="text-red-400" /> TERMINATE SECURITY SESSION
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Render Tab based on active state */}
        {activeTab === 'overview' && (
          <Overview 
            killEvents={killEvents}
            driftEvents={driftEvents}
            valueMetrics={valueMetrics}
            onNavigateTab={setActiveTab}
            avgLatency={avgLatency}
            overallRoi={overallRoi}
            overallCognitiveHealth={overallCognitiveHealth}
            apiLogs={apiLogs}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'secure' && (
          <SecurePillar 
            killEvents={killEvents}
            policies={policies}
            onTriggerKillEvent={handleTriggerKillEvent}
            onClearLogs={handleClearKillLogs}
          />
        )}

        {activeTab === 'observe' && (
          <ObservePillar 
            driftEvents={driftEvents}
            policies={policies}
            onRemediateDrift={handleRemediateDrift}
            onAddDriftEvent={handleAddDriftEvent}
            addToast={addToast}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'measure' && (
          <MeasurePillar 
            valueMetrics={valueMetrics}
            onRefineAgent={handleRefineAgent}
            onAddMetricEvent={handleAddMetricEvent}
            budgetCap={budgetCap}
            onUpdateBudgetCap={setBudgetCap}
          />
        )}

        {activeTab === 'gaas' && (
          <GaaSApiPillar 
            policies={policies}
            onTriggerKillEvent={handleTriggerKillEvent}
            onAddMetricEvent={handleAddMetricEvent}
            governedAgents={governedAgents}
            setGovernedAgents={setGovernedAgents}
            apiLogs={apiLogs}
            setApiLogs={setApiLogs}
            autoRefreshInterval={autoRefreshInterval}
            setAutoRefreshInterval={setAutoRefreshInterval}
            latencyThreshold={latencyThreshold}
            setLatencyThreshold={setLatencyThreshold}
            addToast={addToast}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'policies' && (
          <PolicyConfig 
            policies={policies}
            onTogglePolicy={handleTogglePolicy}
            onAddPolicy={handleAddPolicy}
            onDeletePolicy={handleDeletePolicy}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPillar 
            currentUser={currentUser}
            users={users}
            setUsers={setUsers}
            addToast={addToast}
            disableAlertsGlobally={disableAlertsGlobally}
            setDisableAlertsGlobally={setDisableAlertsGlobally}
          />
        )}

        {activeTab === 'help' && (
          <HelpCenter 
            policies={policies}
            currentUser={currentUser}
            addToast={addToast}
            onNavigateTab={setActiveTab}
            killEvents={killEvents}
            driftEvents={driftEvents}
            valueMetrics={valueMetrics}
            apiLogs={apiLogs}
            governedAgents={governedAgents}
            users={users}
            budgetCap={budgetCap}
            latencyThreshold={latencyThreshold}
          />
        )}
      </main>

      {/* Real-time Sentinel Toaster layer */}
      <ToastNotifier toasts={toasts} onRemoveToast={handleRemoveToast} />
    </div>
  );
}
