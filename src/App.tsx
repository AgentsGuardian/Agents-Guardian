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
import CustomerOnboarding from './components/CustomerOnboarding';
import ToastNotifier from './components/ToastNotifier';
import GaaSAccessGate from './components/GaaSAccessGate';
import NotificationCenter from './components/NotificationCenter';
import UpdatePasswordModal from './components/UpdatePasswordModal';
import { useGovernanceStore } from './store/useGovernanceStore';
import { Sliders, Palette, ChevronDown, Check, LogOut, Users, KeyRound, Eye, ShieldCheck } from 'lucide-react';

import { Policy, KillSignalEvent, DriftLogEvent, ValueMeterMetric, Toast, AdminUser, LaborConfig, AdminRole, OverviewStats } from './types';
import { GUARANTEED_SLA_MS, generateTransactionId } from './utils';
import { INITIAL_ADMINS } from './data';

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && ['overview', 'security', 'observe', 'measure', 'policy', 'gaas', 'admin', 'onboarding', 'help'].includes(hash)) {
      return hash;
    }
    return 'overview';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && ['overview', 'security', 'observe', 'measure', 'policy', 'gaas', 'admin', 'onboarding', 'help'].includes(hash)) {
        setActiveTabState(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Theme state and selector options
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('gaas_active_theme_v1') || 'emerald';
  });
  const [activeBg, setActiveBg] = useState<string>(() => {
    const saved = localStorage.getItem('gaas_active_bg_v1');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [showAppearanceMenu, setShowAppearanceMenu] = useState<boolean>(false);
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('gaas_active_theme_v1', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    localStorage.setItem('gaas_active_bg_v1', activeBg);
    if (activeBg === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    } else {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
  }, [activeBg]);

  const themeOptions = useMemo(() => [
    { id: 'emerald', name: 'Emerald Sentinel', primary: '#1D9E75', rgb: '29, 158, 117', dark: '#0F6E56' },
    { id: 'cyber', name: 'Cyber Neon Cyan', primary: '#06b6d4', rgb: '6, 182, 212', dark: '#0891b2' },
    { id: 'solar', name: 'Amber Solar Core', primary: '#EF9F27', rgb: '239, 159, 39', dark: '#b45309' },
    { id: 'cobalt', name: 'Cobalt Shield', primary: '#3b82f6', rgb: '59, 130, 246', dark: '#1d4ed8' },
    { id: 'purple', name: 'Sovereign Violet', primary: '#a855f7', rgb: '168, 85, 247', dark: '#7e22ce' },
    { id: 'rose', name: 'Rose Red Vigil', primary: '#f43f5e', rgb: '244, 63, 94', dark: '#be123c' }
  ], []);

  const bgOptions = useMemo(() => [
    { id: 'dark', name: 'Dark Mode', shortName: 'Dark Mode', icon: '🌙', isLight: false },
    { id: 'light', name: 'Light Mode', shortName: 'Light Mode', icon: '☀️', isLight: true }
  ], []);

  useEffect(() => {
    const selected = themeOptions.find(t => t.id === activeTheme) || themeOptions[0];

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

      /* Base overrides for tailwind color values */
      .text-\[\#1D9E75\] { color: ${selected.primary} !important; }
      .bg-\[\#1D9E75\] { background-color: ${selected.primary} !important; }
      .border-\[\#1D9E75\] { border-color: ${selected.primary} !important; }

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

  // Data management states from unified store
  const {
    policies,
    setPolicies,
    killEvents,
    setKillEvents,
    driftEvents,
    setDriftEvents,
    valueMetrics,
    setValueMetrics,
    users,
    setUsers,
    actingUserId,
    setActingUserId,
    isLoggedIn,
    setIsLoggedIn,
    governedAgents,
    setGovernedAgents,
    apiLogs,
    setApiLogs,
    laborConfig,
    setLaborConfig,
    budgetCap,
    updateBudgetCap,
    notifications,
    addNotification,
    markAllNotificationsRead,
    clearAllNotifications,
    markNotificationRead,
    disableAlertsGlobally,
    setDisableAlertsGlobally,
    governanceMode,
    setGovernanceMode,
    restSyncStatus,
    globalSettings,
    currentUser: storeCurrentUser,
    effectiveUser,
    authenticatedUser,
    isSwitchedIdentity,
    switchActiveIdentity,
    revertToAuthenticatedIdentity,
    impersonatedRole,
    startImpersonation,
    stopImpersonation,
    updateLaborConfig,
    addAgent,
    updateAgent,
    deleteAgent,
    bulkUpdateAgentsStatus,
    createUser,
    updateUser,
    deleteUser,
    refreshState
  } = useGovernanceStore();

  const defaultUser: AdminUser = useMemo(() => INITIAL_ADMINS[0] || {
    id: 'USR-MJS',
    name: 'Mritunjoy Singh',
    email: 'mritunjoysingh@gmail.com',
    role: 'SuperAdmin',
    status: 'ACTIVE',
    mfaEnabled: true,
    lastLogin: 'Just now'
  }, []);

  const realUser = authenticatedUser || storeCurrentUser || defaultUser;
  const currentUser = effectiveUser || storeCurrentUser || defaultUser;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token')) : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const handleUpdateLaborConfig = (newConfig: LaborConfig) => {
    updateLaborConfig(newConfig);
  };

  const handleUpdateBudgetCap = (cap: number) => {
    updateBudgetCap(cap);
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const setCurrentUser = (selectedVal: AdminUser) => {
    switchActiveIdentity(selectedVal);
  };

  const handleRegisterUser = (newUser: AdminUser) => {
    setUsers(prev => prev.some(u => u.id === newUser.id) ? prev : [...prev, newUser]);
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setUsers(prev => {
      const exists = prev.some(u => u.id === user.id);
      return exists ? prev : [...prev, user];
    });
    setActingUserId(user.id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ag_acting_user_id', user.id);
      localStorage.setItem('ag_acting_user_id', user.id);
    }
    setIsLoggedIn(true);
    refreshState();
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ag_session_token');
      localStorage.removeItem('ag_acting_user_id');
      sessionStorage.removeItem('ag_session_token');
      sessionStorage.removeItem('ag_acting_user_id');
      sessionStorage.removeItem('ag_impersonated_role');
    }
    setActingUserId('');
    setIsLoggedIn(false);
    setShowAppearanceMenu(false);
  };

  // Uplifted GaaS API States
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | 'off'>(30000);
  const [latencyThreshold, setLatencyThreshold] = useState<number>(GUARANTEED_SLA_MS);
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({ total: 0, allowed: 0, blocked: 0 });

  // Fetch real-time server governance state when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    refreshState();
  }, [isLoggedIn, refreshState]);

  // Toast notification states
  const [toasts, setToasts] = useState<Toast[]>([]);

  const disableAlertsRef = React.useRef(disableAlertsGlobally);
  disableAlertsRef.current = disableAlertsGlobally;

  const addToast = (t: Omit<Toast, 'id' | 'timestamp'>) => {
    let category: 'Security' | 'SLA' | 'Policy' | 'System' | 'Audit' = 'System';
    let targetTab: string | undefined = undefined;

    if (t.title.includes('SLA') || t.message.includes('SLA') || t.title.includes('Latency')) {
      category = 'SLA';
      targetTab = 'gaas';
    } else if (t.title.includes('Policy') || t.title.includes('Law') || t.message.includes('policy')) {
      category = 'Policy';
      targetTab = 'policy';
    } else if (t.title.includes('Halt') || t.title.includes('Kill') || t.title.includes('Threat') || t.title.includes('Security')) {
      category = 'Security';
      targetTab = 'security';
    } else if (t.title.includes('Drift') || t.title.includes('Sentiment')) {
      category = 'Audit';
      targetTab = 'observe';
    } else if (t.title.includes('Handshake') || t.title.includes('Onboarding')) {
      category = 'Audit';
      targetTab = 'onboarding';
    }

    addNotification({
      type: t.type,
      category,
      title: t.title,
      message: t.message,
      targetTab
    });

    const isMuteOrRestoreToast = t.title.includes('Notifications Muted') || t.title.includes('Notifications Restored');
    if (disableAlertsRef.current && (t.type === 'danger' || t.type === 'warning') && !isMuteOrRestoreToast) {
      console.log(`[Alert Suppressed] ${t.title}: ${t.message}`);
      return;
    }
    const newToast: Toast = {
      ...t,
      id: generateTransactionId('toast'),
      timestamp: new Date().toISOString()
    };
    setToasts(prev => [newToast, ...prev]);
  };

  const handleRemoveToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Item 5: No synthetic traffic or random SLA breach intervals. Only real server events trigger toasts and SLA alerts.


  // Computed state calculations
  const avgLatency = useMemo(() => {
    const samples = [
      ...apiLogs.map(l => l.latencyMs),
      ...killEvents.map(k => k.latencyMs)
    ].filter((v): v is number => typeof v === 'number' && !isNaN(v) && v >= 0);
    if (samples.length === 0) return 0;
    return Math.round(samples.reduce((acc, curr) => acc + curr, 0) / samples.length);
  }, [apiLogs, killEvents]);

  const overallCognitiveHealth = useMemo(() => {
    const activeDrifts = driftEvents.filter(e => !e.isTest && !(e as any).is_test && !(e as any).archived && !e.remedatedAt);
    if (activeDrifts.length === 0) return 0;
    const total = activeDrifts.reduce((acc, curr) => acc + (typeof curr.cognitiveHealthScore === 'number' ? curr.cognitiveHealthScore : 0), 0);
    return Math.round(total / activeDrifts.length);
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
    fetch('/api/kill-events', { method: 'DELETE', headers: getAuthHeaders() }).catch(e => console.warn(e));
  };

  const handleRemediateDrift = (id: string) => {
    setDriftEvents(prev => prev.map(event => {
      if (event.id === id) {
        const score = typeof event.cognitiveHealthScore === 'number' ? event.cognitiveHealthScore : 100;
        const scoreDerivedStatus = score > 85 ? 'HEALTHY' : score >= 70 ? 'WARNING' : 'CRITICAL';
        return {
          ...event,
          status: scoreDerivedStatus as any,
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

    fetch('/api/policies/toggle', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id })
    }).catch(e => console.warn('Policy toggle server error:', e));
  };

  const handleAddPolicy = (newPolicy: Policy) => {
    setPolicies(prev => [...prev, newPolicy]);
    addToast({
      type: 'success',
      title: 'Governance Policy Registered',
      message: `Successfully provisioned new policy: "${newPolicy.name}" under category: ${newPolicy.category}.`
    });

    fetch('/api/policies', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newPolicy)
    }).catch(e => console.warn('Add policy server error:', e));
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

    fetch(`/api/policies/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(e => console.warn('Delete policy server error:', e));
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
        haltedCount={governedAgents.filter(a => a.status === 'HALTED' || a.status === 'ALERT').length}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        addToast={addToast}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        governanceMode={governanceMode}
      />

      {/* Main content display window */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6 h-screen select-none">
        
        {/* OTP / First-Time Provisioning Password Reminder Banner */}
        {currentUser?.mustResetPassword && !impersonatedRole && (
          <div 
            id="otp-activation-banner"
            className="w-full bg-gradient-to-r from-teal-950/90 via-zinc-900 to-zinc-900 border border-teal-500/40 rounded-xl text-teal-100 px-4 py-3 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center shrink-0">
                <KeyRound size={17} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-teal-300 font-mono text-[11px] uppercase tracking-wider flex items-center gap-2">
                  <span>One-Time Activation Credentials Active</span>
                </div>
                <div className="text-zinc-300 text-[11.5px] mt-0.5">
                  You signed in using a provisioned one-time password. Configure your personal permanent password to finalize account onboarding.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowUpdatePasswordModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-500/25 hover:bg-teal-500/40 border border-teal-400/50 text-teal-100 hover:text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              id="set-permanent-pass-banner-btn"
            >
              <KeyRound size={13} />
              <span>Set Permanent Password</span>
            </button>
          </div>
        )}

        {/* Persistent Scoped Role Impersonation Banner (Visible on every screen during preview mode) */}
        {impersonatedRole && realUser && (
          <div 
            id="impersonation-persistent-banner"
            className="w-full bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border border-amber-500/50 rounded-xl text-amber-100 px-4 py-3 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Eye size={18} className="animate-pulse" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-sans">
                <span className="font-mono uppercase font-black tracking-widest text-[9.5px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded border border-amber-500/50">
                  Role Preview Active
                </span>
                <span className="text-amber-100 text-sm">
                  Viewing as: <strong className="text-amber-300 font-bold underline decoration-amber-400/60 uppercase font-mono">{impersonatedRole}</strong>
                </span>
                <span className="text-amber-300/50 hidden sm:inline">•</span>
                <span className="text-amber-200/90 text-xs font-mono">
                  Real Identity: <strong className="text-white font-bold">{realUser.name}</strong> ({realUser.role})
                </span>
                <span className="text-amber-300/50 hidden md:inline">•</span>
                <span className="text-[10px] text-amber-300/80 font-mono hidden md:inline">
                  (UI preview only — backend authorization strictly preserved)
                </span>
              </div>
            </div>

            <button
              id="exit-impersonation-btn"
              onClick={async () => {
                const res = await stopImpersonation();
                if (res.success) {
                  addToast({
                    type: 'info',
                    title: '👁️ Role Preview Exited',
                    message: `Restored standard ${realUser.role} administrative dashboard view.`
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-100 hover:text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <LogOut size={13} />
              <span>Exit Preview Mode</span>
            </button>
          </div>
        )}

        {/* Persistent Scoped Identity Impersonation Banner */}
        {isSwitchedIdentity && authenticatedUser && (
          <div 
            id="identity-swapped-persistent-banner"
            className="w-full bg-gradient-to-r from-blue-950/95 via-indigo-950/90 to-blue-950/95 border border-cyan-500/50 rounded-xl text-cyan-100 px-4 py-3 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="animate-pulse" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-sans">
                <span className="font-mono uppercase font-black tracking-widest text-[9.5px] bg-cyan-500/30 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/50">
                  Switched Active Identity
                </span>
                <span className="text-cyan-100 text-sm">
                  Active Persona: <strong className="text-cyan-300 font-bold underline decoration-cyan-400/60 uppercase font-mono">{currentUser.name}</strong> ({currentUser.role})
                </span>
                <span className="text-cyan-300/50 hidden sm:inline">•</span>
                <span className="text-cyan-200/90 text-xs font-mono">
                  SuperAdmin Session: <strong className="text-white font-bold">{authenticatedUser.name}</strong> ({authenticatedUser.role})
                </span>
              </div>
            </div>

            <button
              id="revert-swapped-identity-btn"
              onClick={() => {
                revertToAuthenticatedIdentity();
                addToast({
                  type: 'info',
                  title: '🔐 Identity Restored',
                  message: `Returned to authenticated session as ${authenticatedUser.name} (${authenticatedUser.role}).`
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-100 hover:text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <LogOut size={13} />
              <span>Revert to {authenticatedUser.name}</span>
            </button>
          </div>
        )}

        {/* Top Global Administrative Banner - Fixed style with top-right session profile */}
        <div className="bg-[#111E2E] border border-[#1F2E40] rounded-xl px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md bg-opacity-95 backdrop-blur-md transition-all duration-300 relative z-50">
          {/* Left Gateway Route status */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[--theme-primary] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[--theme-primary]"></span>
            </span>
            <div className="text-[11px] font-mono tracking-wider text-zinc-400">
              GATEWAY TUNNEL: <strong className="text-[--theme-primary] uppercase font-black">{activeTab} // MULTI-AGENT SHIELD</strong>
            </div>
            
            {/* System Mode State Pill */}
            <button
              onClick={() => {
                const nextMode = governanceMode === 'active' ? 'setup' : 'active';
                setGovernanceMode(nextMode);
                addToast({
                  type: nextMode === 'active' ? 'success' : 'warning',
                  title: nextMode === 'active' ? '⚡ Active Governance Mode' : '⚙ Setup Mode Enabled',
                  message: nextMode === 'active' 
                    ? 'Platform transitioned to Active Governance Mode. Gateway interception and live policies actively enforced.'
                    : 'Platform transitioned to Setup Mode. Integration wizard and configuration mode active.'
                });
              }}
              title="Click to toggle between Setup Mode and Active Governance Mode"
              className={`text-[9.5px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                governanceMode === 'active' 
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              }`}>
              {governanceMode === 'active' ? '● ACTIVE GOVERNANCE MODE' : '⚙ SETUP MODE'}
            </button>
          </div>

          {/* Top Right: Notification Center & Active security session dropdown */}
          <div className="flex items-center gap-3 shrink-0">
            <NotificationCenter
              notifications={notifications}
              onMarkAllRead={markAllNotificationsRead}
              onClearAll={clearAllNotifications}
              onMarkRead={markNotificationRead}
              disableAlerts={disableAlertsGlobally}
              onToggleDisableAlerts={setDisableAlertsGlobally}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />

            <div className="relative">
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
                  <div className="absolute right-0 mt-2.5 w-76 sm:w-80 bg-[#111E2E] border border-[#1F2E40] rounded-xl shadow-2xl p-4 z-40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
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

                    {/* Role Experience Preview (View-As) Controller for SuperAdmin and Admin */}
                    {(() => {
                      const authenticatedUser = realUser || currentUser;
                      if (authenticatedUser.role !== 'SuperAdmin' && authenticatedUser.role !== 'Admin') return null;

                      const availableRoles: AdminRole[] = authenticatedUser.role === 'SuperAdmin'
                        ? ['Admin', 'PolicyManager', 'Operator', 'Auditor']
                        : ['PolicyManager', 'Operator', 'Auditor'];

                      return (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                              <Eye size={12} className="text-amber-400" />
                              Role Experience Preview
                            </span>
                            {impersonatedRole ? (
                              <span className="text-[8px] bg-amber-500/30 text-amber-200 border border-amber-500/50 px-1.5 py-0.2 rounded font-mono font-bold">
                                PREVIEW: {impersonatedRole}
                              </span>
                            ) : (
                              <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded font-mono">
                                Standard
                              </span>
                            )}
                          </div>

                          <p className="text-[9.5px] font-mono text-zinc-400 leading-snug">
                            View UI as lower-privileged role without altering backend JWT authorization.
                          </p>

                          {impersonatedRole ? (
                            <button
                              onClick={async () => {
                                const res = await stopImpersonation();
                                if (res.success) {
                                  addToast({
                                    type: 'info',
                                    title: '👁️ Role Preview Exited',
                                    message: `Restored standard ${authenticatedUser.role} dashboard view.`
                                  });
                                }
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 hover:text-white text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer"
                            >
                              <LogOut size={11} /> Exit Preview Mode
                            </button>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {availableRoles.map(role => (
                                <button
                                  key={role}
                                  onClick={async () => {
                                    const res = await startImpersonation(role);
                                    if (res.success) {
                                      addToast({
                                        type: 'info',
                                        title: '👁️ Role Preview Activated',
                                        message: `Viewing workspace as ${role}. Backend authorization preserved as ${authenticatedUser.role}.`
                                      });
                                    } else {
                                      addToast({
                                        type: 'danger',
                                        title: 'Preview Failed',
                                        message: res.error || 'Failed to start impersonation'
                                      });
                                    }
                                  }}
                                  className="flex items-center justify-center gap-1 py-1 px-2 bg-black/40 hover:bg-amber-950/40 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-200 text-[9.5px] font-mono rounded transition-all cursor-pointer text-center"
                                >
                                  <span>View {role}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Tenant Identity Isolation & Switch Session Controller */}
                    {(authenticatedUser?.role === 'SuperAdmin' || currentUser.role === 'SuperAdmin') ? (
                      <div className="space-y-2">
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
                              {u.role === 'SuperAdmin' ? '👑 ' : u.role === 'Admin' ? '💎 ' : '👤 '} 
                              {u.name} ({u.role}) {authenticatedUser?.id === u.id ? '★ (Authentic Session)' : ''}
                            </option>
                          ))}
                        </select>

                        {isSwitchedIdentity && authenticatedUser && (
                          <button
                            onClick={() => {
                              revertToAuthenticatedIdentity();
                              addToast({
                                type: 'info',
                                title: '🔐 Identity Restored',
                                message: `Returned to authenticated session as ${authenticatedUser.name} (${authenticatedUser.role}).`
                              });
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer"
                          >
                            <LogOut size={12} /> Revert to {authenticatedUser.name} (SuperAdmin)
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setActiveTab('admin');
                            setShowAppearanceMenu(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#1D9E75]/15 hover:bg-[#1D9E75]/25 border border-[#1D9E75]/35 text-[#1D9E75] text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer"
                        >
                          <Users size={12} /> View All Registered User Profiles ({users.length})
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl space-y-2">
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
                          Dedicated customer instance locked to <strong className="text-white">{currentUser.name}</strong> ({currentUser.role}). Global identity switching is restricted by policy.
                        </p>
                        {currentUser.role === 'Admin' && (
                          <button
                            onClick={() => {
                              setActiveTab('admin');
                              setShowAppearanceMenu(false);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-teal-950/30 hover:bg-teal-900/40 border border-teal-500/30 text-teal-300 text-[9.5px] font-mono font-bold rounded transition-all cursor-pointer mt-1"
                          >
                            <Users size={11} /> View Registered User Directory ({users.length})
                          </button>
                        )}
                      </div>
                    )}

                    {/* Simplified Theme & Contrast Section */}
                    <div className="space-y-3 pt-3 border-t border-[#1F2E40]/50">
                      <div className="flex items-center justify-between font-mono select-none">
                        <span className="text-[9.5px] text-[#8B9BAA] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <Palette size={12} className="text-[--theme-primary]" /> Theme & Contrast
                        </span>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-zinc-300 border border-zinc-800">
                          {bgOptions.find(b => b.id === activeBg)?.isLight ? '☀️ Light' : '🌙 Dark'}
                        </span>
                      </div>

                      {/* Display Mode Toggle */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {bgOptions.map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => {
                              setActiveBg(bg.id);
                              addToast({
                                type: 'success',
                                title: bg.isLight ? '☀️ Light Theme Applied' : '🌙 Dark Theme Applied',
                                message: `Display environment remapped to ${bg.name} theme with calibrated contrast.`
                              });
                            }}
                            className={`px-2.5 py-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer text-[10px] font-mono font-bold leading-none ${
                              activeBg === bg.id 
                                ? 'border-[--theme-primary] bg-[--theme-primary]/15 text-white shadow' 
                                : 'border-zinc-800 hover:border-zinc-700 bg-black/30 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs">{bg.icon}</span>
                              <span>{bg.shortName}</span>
                            </span>
                            {activeBg === bg.id && <Check size={12} className="text-[--theme-primary]" />}
                          </button>
                        ))}
                      </div>

                      {/* Accent Palette Selector */}
                      <div className="space-y-1.5">
                        <span className="text-[8.5px] text-zinc-400 font-mono font-bold uppercase tracking-wider block">
                          Accent Color:
                        </span>
                        <div className="grid grid-cols-6 gap-1.5">
                          {themeOptions.map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              title={theme.name}
                              onClick={() => {
                                setActiveTheme(theme.id);
                                addToast({
                                  type: 'success',
                                  title: '🎨 Accent Color Applied',
                                  message: `System accent updated to "${theme.name}".`
                                });
                              }}
                              className={`h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                activeTheme === theme.id 
                                  ? 'border-white scale-105 shadow bg-white/10' 
                                  : 'border-zinc-800 hover:border-zinc-700 bg-black/20'
                              }`}
                            >
                              <span 
                                className="w-3.5 h-3.5 rounded-full inline-block shadow-inner" 
                                style={{ backgroundColor: theme.primary }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Active theme code designation */}
                    <div className="text-[9.5px] text-zinc-500 font-mono flex justify-between items-center select-none pt-2 border-t border-[#1F2E40]/50">
                      <span>Active Theme:</span>
                      <span className="text-zinc-300 font-bold uppercase tracking-wider">
                        {themeOptions.find(t => t.id === activeTheme)?.name.split(' ')[0]} ({bgOptions.find(b => b.id === activeBg)?.shortName})
                      </span>
                    </div>

                    {/* Update Administrative Password Button */}
                    <div className="pt-2 border-t border-[#1F2E40]/50">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAppearanceMenu(false);
                          setShowUpdatePasswordModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-950/30 hover:bg-teal-900/40 border border-teal-500/30 hover:border-teal-500/50 text-teal-300 text-[10.5px] font-mono font-bold rounded-lg transition-all cursor-pointer transform active:scale-98"
                      >
                        <KeyRound size={13} className="text-teal-400" /> UPDATE ADMIN PASSWORD
                      </button>
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
            policies={policies}
            laborConfig={laborConfig}
            restConnectionStatus={restSyncStatus}
            bypassPolicyGuard={globalSettings?.bypassPolicyGuard}
            governedAgents={governedAgents}
            governanceMode={governanceMode}
            setGovernanceMode={setGovernanceMode}
            overviewStats={overviewStats}
            onOverviewStatsChange={setOverviewStats}
          />
        )}

        {activeTab === 'secure' && (
          <SecurePillar 
            killEvents={killEvents}
            policies={policies}
            onTriggerKillEvent={handleTriggerKillEvent}
            onClearLogs={handleClearKillLogs}
            overviewStats={overviewStats}
            onOverviewStatsChange={setOverviewStats}
          />
        )}

        {activeTab === 'observe' && (
          <ObservePillar 
            driftEvents={driftEvents}
            policies={policies}
            onRemediateDrift={handleRemediateDrift}
            onAddDriftEvent={handleAddDriftEvent}
            onSetDriftEvents={setDriftEvents}
            addToast={addToast}
            currentUser={currentUser}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'measure' && (
          <MeasurePillar 
            valueMetrics={valueMetrics}
            onRefineAgent={handleRefineAgent}
            onAddMetricEvent={handleAddMetricEvent}
            budgetCap={budgetCap}
            onUpdateBudgetCap={handleUpdateBudgetCap}
            laborConfig={laborConfig}
            onUpdateLaborConfig={handleUpdateLaborConfig}
          />
        )}

        {activeTab === 'gaas' && (
          <GaaSApiPillar 
            policies={policies}
            onTriggerKillEvent={handleTriggerKillEvent}
            onAddMetricEvent={handleAddMetricEvent}
            governedAgents={governedAgents}
            setGovernedAgents={setGovernedAgents}
            onAddAgent={addAgent}
            onUpdateAgent={updateAgent}
            onDeleteAgent={deleteAgent}
            onBulkAgentStatus={bulkUpdateAgentsStatus}
            onRefreshState={refreshState}
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
            realUser={realUser}
            impersonatedRole={impersonatedRole}
            onStartImpersonation={startImpersonation}
            onStopImpersonation={stopImpersonation}
            onSwitchIdentity={setCurrentUser}
            users={users}
            setUsers={setUsers}
            onCreateUser={createUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            addToast={addToast}
            disableAlertsGlobally={disableAlertsGlobally}
            setDisableAlertsGlobally={setDisableAlertsGlobally}
          />
        )}

        {activeTab === 'onboarding' && (
          <CustomerOnboarding
            currentUser={currentUser}
            addToast={addToast}
            onNavigateTab={setActiveTab}
            budgetCap={budgetCap}
            laborConfig={laborConfig}
            policies={policies}
            governanceMode={governanceMode}
            setGovernanceMode={setGovernanceMode}
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
            laborConfig={laborConfig}
          />
        )}
      </main>

      {/* Real-time Sentinel Toaster layer */}
      <ToastNotifier toasts={toasts} onRemoveToast={handleRemoveToast} />

      {/* Account Security Password Modal */}
      <UpdatePasswordModal
        isOpen={showUpdatePasswordModal}
        onClose={() => setShowUpdatePasswordModal(false)}
        currentUser={currentUser}
        addToast={addToast}
      />
    </div>
  );
}
