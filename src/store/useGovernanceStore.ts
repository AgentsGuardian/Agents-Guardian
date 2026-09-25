import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Policy, 
  KillSignalEvent, 
  DriftLogEvent, 
  ValueMeterMetric, 
  GoverningAgent, 
  AdminUser, 
  LaborConfig,
  AdminRole 
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
  const [laborConfig, setLaborConfig] = useState<LaborConfig>({
    l1Rate: 35,
    l2Rate: 75,
    l3Rate: 150,
    auditRate: 60,
    avgHoursPerTask: 0.25
  });
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [governanceMode, setGovernanceModeState] = useState<'setup' | 'active'>('active');
  const [disableAlertsGlobally, setDisableAlertsGlobally] = useState<boolean>(false);
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

  // Derived real current user: returns the matched authenticated user or null
  const currentUser = useMemo<AdminUser | null>(() => {
    if (!actingUserId) return null;
    const found = users.find(u => u.id === actingUserId || u.email.toLowerCase().trim() === actingUserId.toLowerCase().trim());
    return found || null;
  }, [users, actingUserId]);

  // Derived effective user: UI preview persona when impersonation is active, real user otherwise
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
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ag_session_token');
          localStorage.removeItem('ag_acting_user_id');
          sessionStorage.removeItem('ag_session_token');
          sessionStorage.removeItem('ag_acting_user_id');
          sessionStorage.removeItem('ag_impersonated_role');
        }
        setActingUserId('');
        setIsLoggedIn(false);
        setIsLoading(false);
        return;
      }

      const sessionData = await sessionRes.json();
      const authUser: AdminUser = sessionData.user;
      if (authUser && authUser.id) {
        setActingUserId(authUser.id);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ag_acting_user_id', authUser.id);
          localStorage.setItem('ag_acting_user_id', authUser.id);
        }
      }

      // Step 2: Fetch global governance state
      const res = await fetch('/api/state', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
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

      const data = await res.json();
      if (data.policies) setPolicies(data.policies);
      if (data.killEvents) setKillEvents(data.killEvents);
      if (data.driftEvents) setDriftEvents(data.driftEvents);
      if (data.valueMetrics) setValueMetrics(data.valueMetrics);
      if (data.users) setUsers(data.users);
      if (data.governedAgents) setGovernedAgents(data.governedAgents);
      if (data.laborConfig) setLaborConfig(data.laborConfig);
      if (data.notifications) setNotifications(data.notifications);
      if (data.governanceMode) setGovernanceModeState(data.governanceMode);
      setIsLoggedIn(true);
    } catch (err) {
      console.warn('[GovernanceStore] Admin API state sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
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
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(agent)
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error('Failed to add agent via API:', err);
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
    if (mode === 'active') {
      try {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: getAuthHeaders()
        });
        await refreshState();
      } catch (err) {
        console.error('Failed to set governance mode via API:', err);
      }
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
    laborConfig,
    setLaborConfig,
    notifications,
    setNotifications,
    disableAlertsGlobally,
    setDisableAlertsGlobally,
    governanceMode,
    setGovernanceMode,
    currentUser,
    effectiveUser,
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
    updateLaborConfig,
    addNotification,
    markAllNotificationsRead,
    clearAllNotifications,
    markNotificationRead
  };
}
