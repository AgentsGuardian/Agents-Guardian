import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Policy, 
  KillSignalEvent, 
  DriftLogEvent, 
  ValueMeterMetric, 
  GoverningAgent, 
  AdminUser, 
  LaborConfig 
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
  const [actingUserId, setActingUserId] = useState<string>('USR-001');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
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

  // Derived current user
  const currentUser = useMemo(() => {
    const found = users.find(u => u.id === actingUserId || u.email.toLowerCase().trim() === actingUserId.toLowerCase().trim());
    if (found) return found;
    return users.find(u => u.status === 'ACTIVE') || {
      id: 'USR-001',
      name: 'Mritunjoy Singh',
      email: 'mritunjoysingh@gmail.com',
      role: 'SuperAdmin',
      status: 'ACTIVE',
      mfaEnabled: true,
      lastLogin: 'Active Session'
    };
  }, [users, actingUserId]);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': currentUser.email || 'mritunjoysingh@gmail.com',
      'Authorization': `Bearer session_${currentUser.id || 'USR-001'}`
    };
  }, [currentUser]);

  // Fetch real authenticated backend state on mount or when auth user changes
  const refreshState = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/state', {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    } catch (err) {
      console.warn('[GovernanceStore] Admin API state sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

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
