import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Policy, 
  KillSignalEvent, 
  DriftLogEvent, 
  ValueMeterMetric, 
  GoverningAgent, 
  ApiRequestLog,
  AdminUser, 
  LaborConfig,
  AdminRole,
  GlobalAdminSettings
} from '../types';

import { generateTransactionId } from '../utils';

export interface SystemNotification {
  id: string;
  timestamp: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  category: 'Security' | 'SLA' | 'Policy' | 'System' | 'Audit';
  title: string;
  message: string;
  read: boolean;
  targetTab?: string;
}

export function useGovernanceStore() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [killEvents, setKillEvents] = useState<KillSignalEvent[]>([]);
  const [driftEvents, setDriftEvents] = useState<DriftLogEvent[]>([]);
  const [valueMetrics, setValueMetrics] = useState<ValueMeterMetric[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [actingUserId, setActingUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ag_acting_user_id') || localStorage.getItem('ag_acting_user_id') || '';
    }
    return '';
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [governedAgents, setGovernedAgents] = useState<GoverningAgent[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiRequestLog[]>([]);
  const [laborConfig, setLaborConfig] = useState<LaborConfig>({
    l1Rate: 35,
    l2Rate: 75,
    l3Rate: 150,
    auditRate: 60,
    avgHoursPerTask: 0.25
  });
  const [budgetCap, setBudgetCap] = useState<number>(500);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [governanceMode, setGovernanceModeState] = useState<'setup' | 'active'>('active');
  const [disableAlertsGlobally, setDisableAlertsGlobally] = useState<boolean>(false);
  const [restSyncStatus, setRestSyncStatus] = useState<'SYNCHRONIZED' | 'DEGRADED' | 'DISCONNECTED'>('SYNCHRONIZED');
  const [globalSettings, setGlobalSettings] = useState<GlobalAdminSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [impersonatedRole, setImpersonatedRole] = useState<AdminRole | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ag_impersonated_role');
      if (stored && ['SuperAdmin', 'Admin', 'PolicyManager', 'Operator', 'Auditor'].includes(stored)) {
        return stored as AdminRole;
      }
    }
    return null;
  });

  const [authenticatedUser, setAuthenticatedUser] = useState<AdminUser | null>(null);

  // Derived real current user: returns the matched acting user, or falls back to authenticated session user
  const currentUser = useMemo<AdminUser | null>(() => {
    if (!actingUserId) return authenticatedUser || null;
    const found = users.find(u => u.id === actingUserId || u.email.toLowerCase().trim() === actingUserId.toLowerCase().trim());
    return found || authenticatedUser || null;
  }, [users, actingUserId, authenticatedUser]);

  // Derived effective user: UI preview persona when role impersonation is active, real current user otherwise
  const effectiveUser = useMemo<AdminUser | null>(() => {
    if (!currentUser) return null;
    if (impersonatedRole) {
      return {
        ...currentUser,
        role: impersonatedRole
      };
    }
    return currentUser;
  }, [currentUser, impersonatedRole]);

  // Identity switching helpers for SuperAdmin
  const isSwitchedIdentity = useMemo<boolean>(() => {
    return Boolean(
      authenticatedUser && 
      actingUserId && 
      actingUserId !== authenticatedUser.id &&
      (authenticatedUser.role === 'SuperAdmin' || authenticatedUser.role === 'Admin')
    );
  }, [authenticatedUser, actingUserId]);

  const switchActiveIdentity = useCallback((selectedUser: AdminUser) => {
    setActingUserId(selectedUser.id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ag_acting_user_id', selectedUser.id);
      localStorage.setItem('ag_acting_user_id', selectedUser.id);
    }
  }, []);

  const revertToAuthenticatedIdentity = useCallback(() => {
    if (authenticatedUser?.id) {
      setActingUserId(authenticatedUser.id);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ag_acting_user_id', authenticatedUser.id);
        localStorage.setItem('ag_acting_user_id', authenticatedUser.id);
      }
    }
  }, [authenticatedUser]);

  const getAuthHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token')) : null;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }, []);

  // Fetch real authenticated backend state on mount or when auth user changes
  const refreshState = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token')) : null;
      if (!token) {
        setIsLoggedIn(false);
        setIsLoading(false);
        return;
      }

      // Step 1: Verify token authenticity with authoritative session API
      const sessionRes = await fetch('/api/auth/session', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!sessionRes.ok) {
        if (sessionRes.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ag_session_token');
            localStorage.removeItem('ag_acting_user_id');
            sessionStorage.removeItem('ag_session_token');
            sessionStorage.removeItem('ag_acting_user_id');
            sessionStorage.removeItem('ag_impersonated_role');
          }
          setActingUserId('');
          setAuthenticatedUser(null);
          setIsLoggedIn(false);
        }
        setIsLoading(false);
        return;
      }

      const sessionData = await sessionRes.json();
      const authUser: AdminUser = sessionData.user;
      if (authUser && authUser.id) {
        setAuthenticatedUser(authUser);

        const storedActingId = typeof window !== 'undefined'
          ? (sessionStorage.getItem('ag_acting_user_id') || localStorage.getItem('ag_acting_user_id'))
          : '';

        // If the authenticated user is SuperAdmin and has chosen a switched identity, preserve it across polling
        if (authUser.role === 'SuperAdmin' && storedActingId) {
          setActingUserId(storedActingId);
        } else if (!storedActingId || authUser.role !== 'SuperAdmin') {
          setActingUserId(authUser.id);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('ag_acting_user_id', authUser.id);
            localStorage.setItem('ag_acting_user_id', authUser.id);
          }
        }
      }
      setIsLoggedIn(true);

      // Step 2: Fetch global governance state & live health
      const [res, healthRes] = await Promise.all([
        fetch('/api/state', {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch('/api/health', { cache: 'no-store' }).catch(() => null)
      ]);

      if (!res.ok) {
        setRestSyncStatus('DISCONNECTED');
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ag_session_token');
            localStorage.removeItem('ag_acting_user_id');
            sessionStorage.removeItem('ag_session_token');
            sessionStorage.removeItem('ag_acting_user_id');
          }
          setActingUserId('');
          setIsLoggedIn(false);
        }
        return;
      }

      if (healthRes && healthRes.ok) {
        const healthData = await healthRes.json().catch(() => null);
        setRestSyncStatus(healthData?.degraded ? 'DEGRADED' : 'SYNCHRONIZED');
      } else {
        setRestSyncStatus('SYNCHRONIZED');
      }

      const data = await res.json();
      if (data.policies) setPolicies(data.policies);
      if (data.killEvents) setKillEvents(data.killEvents);
      if (data.driftEvents) setDriftEvents(data.driftEvents);
      if (data.valueMetrics) setValueMetrics(data.valueMetrics);
      if (data.users) {
        if (authUser && !data.users.some((u: AdminUser) => u.id === authUser.id)) {
          setUsers([authUser, ...data.users]);
        } else {
          setUsers(data.users);
        }
      } else if (authUser) {
        setUsers(prev => prev.some(u => u.id === authUser.id) ? prev : [authUser, ...prev]);
      }
      if (data.governedAgents) setGovernedAgents(data.governedAgents);
      if (Array.isArray(data.apiLogs)) setApiLogs(data.apiLogs);
      if (data.laborConfig) setLaborConfig(data.laborConfig);
      if (typeof data.budgetCap === 'number') setBudgetCap(data.budgetCap);
      if (data.notifications) setNotifications(data.notifications);
      if (data.governanceMode) setGovernanceModeState(data.governanceMode);
      if (data.globalSettings) setGlobalSettings(data.globalSettings);
      setIsLoggedIn(true);
    } catch (err) {
      setRestSyncStatus('DISCONNECTED');
      console.warn('[GovernanceStore] Admin API state sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
    // Real-time synchronization loop: continuously poll server and Firestore every 4s
    const pollInterval = setInterval(() => {
      if (typeof window !== 'undefined' && (sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token'))) {
        refreshState();
      }
    }, 4000);

    const handleFocus = () => {
      if (typeof window !== 'undefined' && (sessionStorage.getItem('ag_session_token') || localStorage.getItem('ag_session_token'))) {
        refreshState();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshState]);

  // Actions wired to Backend API
  const addPolicy = useCallback(async (newPolicy: Partial<Policy>) => {
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPolicy)
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to add policy via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const togglePolicy = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/policies/toggle', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to toggle policy via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const deletePolicy = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to delete policy via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const addKillEvent = useCallback(async (event: Partial<KillSignalEvent>) => {
    try {
      const res = await fetch('/api/kill-events', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(event)
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to add kill event via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const clearKillEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/kill-events', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to clear kill events via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const addAgent = useCallback(async (agent: Partial<GoverningAgent>) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(agent)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Failed to register agent (HTTP ${res.status})`);
    }
    await refreshState();
  }, [getAuthHeaders, refreshState]);

  const updateAgent = useCallback(async (id: string, updates: Partial<GoverningAgent>) => {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await refreshState();
      throw new Error(data?.error || `Failed to update agent (HTTP ${res.status})`);
    }
    await refreshState();
  }, [getAuthHeaders, refreshState]);

  const deleteAgent = useCallback(async (id: string) => {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await refreshState();
      throw new Error(data?.error || `Failed to delete agent (HTTP ${res.status})`);
    }
    setApiLogs(prev => prev.filter(l => l.agentId.toLowerCase() !== id.toLowerCase()));
    await refreshState();
  }, [getAuthHeaders, refreshState]);

  const bulkUpdateAgentsStatus = useCallback(async (ids: string[], status: 'NOMINAL' | 'ALERT' | 'HALTED') => {
    const res = await fetch('/api/agents/bulk-status', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids, status })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await refreshState();
      throw new Error(data?.error || `Failed to update agents (HTTP ${res.status})`);
    }
    await refreshState();
  }, [getAuthHeaders, refreshState]);

  const createUser = useCallback(async (user: Partial<AdminUser>) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(user)
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to create user via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const updateUser = useCallback(async (id: string, updates: Partial<AdminUser>) => {
    try {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to update user via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const deleteUser = useCallback(async (id: string) => {
    try {
      setUsers(prev => prev.filter(u => u.id !== id));
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to delete user via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const updateLaborConfig = useCallback(async (config: LaborConfig) => {
    try {
      setLaborConfig(config);
      await fetch('/api/labor-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
    } catch (err) {
      console.error('Failed to update labor config via API:', err);
    }
  }, [getAuthHeaders]);

  const updateBudgetCap = useCallback(async (cap: number) => {
    try {
      setBudgetCap(cap);
      await fetch('/api/budget-cap', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ budgetCap: cap })
      });
      await refreshState();
    } catch (err) {
      console.error('Failed to update budget cap via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('Failed to mark notifications read via API:', err);
    }
  }, [getAuthHeaders]);

  const clearAllNotifications = useCallback(async () => {
    try {
      setNotifications([]);
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('Failed to clear notifications via API:', err);
    }
  }, [getAuthHeaders]);

  const setGovernanceMode = useCallback(async (mode: 'setup' | 'active') => {
    setGovernanceModeState(mode);
    try {
      if (mode === 'active') {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } else {
        await fetch('/api/governance-mode', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ mode })
        });
      }
      await refreshState();
    } catch (err) {
      console.error('Failed to set governance mode via API:', err);
    }
  }, [getAuthHeaders, refreshState]);

  const addNotification = useCallback((notif: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: SystemNotification = {
      ...notif,
      id: generateTransactionId('notif'),
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const startImpersonation = useCallback(async (targetRole: AdminRole) => {
    try {
      const res = await fetch('/api/impersonation/start', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to start role impersonation (HTTP ${res.status})`);
      }
      setImpersonatedRole(targetRole);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ag_impersonated_role', targetRole);
      }
      return { success: true, impersonatedRole: targetRole, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to start role impersonation' };
    }
  }, [getAuthHeaders]);

  const stopImpersonation = useCallback(async () => {
    try {
      const prev = impersonatedRole;
      await fetch('/api/impersonation/stop', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ previousRole: prev })
      });
      setImpersonatedRole(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('ag_impersonated_role');
      }
      return { success: true };
    } catch (err: any) {
      setImpersonatedRole(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('ag_impersonated_role');
      }
      return { success: false, error: err.message || 'Failed to stop impersonation cleanly' };
    }
  }, [getAuthHeaders, impersonatedRole]);

  return {
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
    setBudgetCap,
    updateBudgetCap,
    notifications,
    setNotifications,
    disableAlertsGlobally,
    setDisableAlertsGlobally,
    governanceMode,
    setGovernanceMode,
    restSyncStatus,
    globalSettings,
    currentUser,
    effectiveUser,
    authenticatedUser,
    isSwitchedIdentity,
    switchActiveIdentity,
    revertToAuthenticatedIdentity,
    impersonatedRole,
    startImpersonation,
    stopImpersonation,
    isLoading,
    refreshState,
    addPolicy,
    togglePolicy,
    deletePolicy,
    addKillEvent,
    clearKillEvents,
    addAgent,
    updateAgent,
    deleteAgent,
    bulkUpdateAgentsStatus,
    createUser,
    updateUser,
    deleteUser,
    updateLaborConfig,
    addNotification,
    markAllNotificationsRead,
    clearAllNotifications,
    markNotificationRead
  };
}
