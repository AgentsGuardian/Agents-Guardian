import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Policy, 
  KillSignalEvent, 
  DriftLogEvent, 
  ValueMeterMetric, 
  GoverningAgent, 
  ApiRequestLog, 
  AdminUser, 
  LaborConfig 
} from '../types';
import { 
  INITIAL_POLICIES, 
  INITIAL_KILL_SWITCH_EVENTS, 
  INITIAL_DRIFT_EVENTS, 
  INITIAL_VALUE_METRICS, 
  INITIAL_ADMINS 
} from '../data';

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

const INITIAL_GOVERNED_AGENTS: GoverningAgent[] = [
  { id: 'GA-101', name: 'SalesSummarizer-CrewAI', framework: 'CrewAI', webhookUrl: 'https://internal-workflow.org/hooks/sales-bot', attachedPolicyCode: 'POL-SEC-01', status: 'NOMINAL', requestCount: 394 },
  { id: 'GA-102', name: 'AutoTrader-Langchain', framework: 'LangChain', webhookUrl: 'https://trading-node-2.net/gaas/gate', attachedPolicyCode: 'POL-FIN-01', status: 'NOMINAL', requestCount: 1242 },
  { id: 'GA-103', name: 'AutoGen-TriageHQ', framework: 'AutoGen', webhookUrl: 'https://conversation.firm.com/api/v1', attachedPolicyCode: 'POL-ETH-01', status: 'NOMINAL', requestCount: 8905 },
  { id: 'GA-104', name: 'Postgres-MCP-Server', framework: 'MCP Server', webhookUrl: 'https://mcp.enterprise.io/v1/tools/call', attachedPolicyCode: 'POL-SEC-01', status: 'NOMINAL', requestCount: 2150 }
];

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    type: 'warning',
    category: 'SLA',
    title: 'SLA Latency Warning',
    message: 'Postgres-MCP-Server payload evaluation exceeded 35ms SLA target (42ms).',
    read: false,
    targetTab: 'gaas'
  },
  {
    id: 'notif-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    type: 'info',
    category: 'Policy',
    title: 'EU AI Act Rules Loaded',
    message: 'Regulatory ingestion compiler synthesized 3 active enforcement rules.',
    read: false,
    targetTab: 'policy'
  },
  {
    id: 'notif-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    type: 'success',
    category: 'Audit',
    title: 'Handshake Verified',
    message: 'GaaS Proxy Client handshake verified with RSA-4096 signature.',
    read: true,
    targetTab: 'onboarding'
  }
];

export function useGovernanceStore() {
  // Policies state
  const [policies, setPolicies] = useState<Policy[]>(() => {
    const saved = localStorage.getItem('gaas_policies_v1');
    return saved ? JSON.parse(saved) : INITIAL_POLICIES;
  });

  // Kill events state
  const [killEvents, setKillEvents] = useState<KillSignalEvent[]>(() => {
    const saved = localStorage.getItem('gaas_kill_events_v1');
    return saved ? JSON.parse(saved) : INITIAL_KILL_SWITCH_EVENTS;
  });

  // Drift events state
  const [driftEvents, setDriftEvents] = useState<DriftLogEvent[]>(() => {
    const saved = localStorage.getItem('gaas_drift_events_v1');
    return saved ? JSON.parse(saved) : INITIAL_DRIFT_EVENTS;
  });

  // Value metrics state
  const [valueMetrics, setValueMetrics] = useState<ValueMeterMetric[]>(() => {
    const saved = localStorage.getItem('gaas_value_metrics_v1');
    return saved ? JSON.parse(saved) : INITIAL_VALUE_METRICS;
  });

  // Admin users state
  const [users, setUsers] = useState<AdminUser[]>(() => {
    const saved = localStorage.getItem('gaas_captured_people_v1');
    return saved ? JSON.parse(saved) : INITIAL_ADMINS;
  });

  // Acting user state
  const [actingUserId, setActingUserId] = useState<string>(() => {
    return localStorage.getItem('gaas_logged_in_user_id') || 'USR-001';
  });

  // Logged in state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('gaas_is_logged_in') === 'true';
  });

  // Governed Agents
  const [governedAgents, setGovernedAgents] = useState<GoverningAgent[]>(() => {
    const saved = localStorage.getItem('gaas_agents_v1');
    return saved ? JSON.parse(saved) : INITIAL_GOVERNED_AGENTS;
  });

  // Labor config
  const [laborConfig, setLaborConfig] = useState<LaborConfig>(() => {
    const saved = localStorage.getItem('gaas_labor_config_v1');
    return saved ? JSON.parse(saved) : {
      l1Rate: 35,
      l2Rate: 75,
      l3Rate: 150,
      auditRate: 60,
      avgHoursPerTask: 0.25
    };
  });

  // System Notifications for Notification Center
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    const saved = localStorage.getItem('gaas_notifications_v1');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // Global alert suppression
  const [disableAlertsGlobally, setDisableAlertsGlobally] = useState<boolean>(() => {
    return localStorage.getItem('gaas_mute_alerts_v1') === 'true';
  });

  // Sync state to localStorage on updates
  useEffect(() => {
    localStorage.setItem('gaas_policies_v1', JSON.stringify(policies));
  }, [policies]);

  useEffect(() => {
    localStorage.setItem('gaas_kill_events_v1', JSON.stringify(killEvents));
  }, [killEvents]);

  useEffect(() => {
    localStorage.setItem('gaas_drift_events_v1', JSON.stringify(driftEvents));
  }, [driftEvents]);

  useEffect(() => {
    localStorage.setItem('gaas_value_metrics_v1', JSON.stringify(valueMetrics));
  }, [valueMetrics]);

  useEffect(() => {
    localStorage.setItem('gaas_captured_people_v1', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('gaas_agents_v1', JSON.stringify(governedAgents));
  }, [governedAgents]);

  useEffect(() => {
    localStorage.setItem('gaas_notifications_v1', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('gaas_mute_alerts_v1', disableAlertsGlobally ? 'true' : 'false');
  }, [disableAlertsGlobally]);

  // Derived current user
  const currentUser = useMemo(() => {
    const found = users.find(u => u.id === actingUserId || u.email.toLowerCase().trim() === actingUserId.toLowerCase().trim());
    if (found) return found;
    return users.find(u => u.status === 'ACTIVE') || users[0] || INITIAL_ADMINS[1];
  }, [users, actingUserId]);

  // Notification actions
  const addNotification = useCallback((notif: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: SystemNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
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
    currentUser,
    addNotification,
    markAllNotificationsRead,
    clearAllNotifications,
    markNotificationRead
  };
}
