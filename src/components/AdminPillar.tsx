/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, Key, ShieldAlert, SlidersHorizontal, Plus, Trash2, 
  Fingerprint, Globe, Check, AlertTriangle, ShieldCheck, 
  Search, UserCheck, Shield, Lock, Eye, AlertCircle, KeyRound
} from 'lucide-react';
import { AdminUser, AdminRole, RolePermission, GlobalAdminSettings } from '../types';
import { RefreshCw, Link2, LogOut, BellOff } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import UpdatePasswordModal from './UpdatePasswordModal';

interface AdminPillarProps {
  currentUser: AdminUser;
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
  disableAlertsGlobally: boolean;
  setDisableAlertsGlobally: (val: boolean) => void;
}

const INITIAL_PERMISSIONS: RolePermission[] = [
  { role: 'SuperAdmin', configureKillSwitch: true, modifyPolicies: true, viewFinancialMetrics: true, updateGatewaySLAs: true, manageUsers: true },
  { role: 'Admin', configureKillSwitch: true, modifyPolicies: true, viewFinancialMetrics: true, updateGatewaySLAs: true, manageUsers: true },
  { role: 'PolicyManager', configureKillSwitch: false, modifyPolicies: true, viewFinancialMetrics: true, updateGatewaySLAs: true, manageUsers: false },
  { role: 'Auditor', configureKillSwitch: false, modifyPolicies: false, viewFinancialMetrics: true, updateGatewaySLAs: false, manageUsers: false },
  { role: 'Operator', configureKillSwitch: true, modifyPolicies: false, viewFinancialMetrics: false, updateGatewaySLAs: true, manageUsers: false }
];

export default function AdminPillar({ 
  currentUser,
  users,
  setUsers,
  addToast, 
  disableAlertsGlobally, 
  setDisableAlertsGlobally 
}: AdminPillarProps) {
  const [activeSubTab, setActiveSubTab] = useState<'iam' | 'roles' | 'settings' | 'registry'>('iam');
  
  // React State
  const [permissions, setPermissions] = useState<RolePermission[]>(INITIAL_PERMISSIONS);

  // Confirmation modal states
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUser | null>(null);
  const [statusConfirmUser, setStatusConfirmUser] = useState<AdminUser | null>(null);
  const [showBypassModal, setShowBypassModal] = useState<boolean>(false);
  const [bypassTimerSeconds, setBypassTimerSeconds] = useState<number | null>(null);

  // Inline Form Error State
  const [createUserError, setCreateUserError] = useState<{ name?: string; email?: string } | null>(null);

  const isDevelopmentTeam = (email: string) => {
    return email.toLowerCase().trim() === 'mritunjoysingh@gmail.com';
  };

  const currentRolePerms = permissions.find(p => p.role === currentUser.role) || {
    configureKillSwitch: false,
    modifyPolicies: false,
    viewFinancialMetrics: false,
    updateGatewaySLAs: false,
    manageUsers: false
  };

  const canConfigureSystem = currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin';
  const [settings, setSettings] = useState<GlobalAdminSettings>({
    bypassPolicyGuard: false,
    auditLogLevel: 'INFO',
    maxSessionTimeoutHrs: 4,
    ipWhitelistRange: '10.85.0.0/16, 192.168.14.0/24',
    mfaEnforcement: true,
    disableAlertsGlobally: disableAlertsGlobally
  });

  // IAM Integration State
  const [iamProvider, setIamProvider] = useState<'NONE' | 'OKTA' | 'AZURE' | 'PING' | 'GOOGLE'>('NONE');
  const [iamClientId, setIamClientId] = useState('cid-guardian-9104');
  const [iamIssuerUrl, setIamIssuerUrl] = useState('https://guardian-corp.okta.com/oauth2/default');
  const [iamTenantId, setIamTenantId] = useState('tenant-azure-f88a-21');
  const [iamSyncGroup, setIamSyncGroup] = useState('SecOps_Admins, Guardian_Policy_Engineers');
  const [iamSsoOnly, setIamSsoOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // User list searches
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedUser, setInspectedUser] = useState<AdminUser | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<AdminUser | null>(null);
  
  // Create user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('Operator');
  const [newMfa, setNewMfa] = useState(true);

  // Filtered Users
  const filteredUsers = users.filter(usr => 
    usr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    usr.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    usr.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      addToast({
        type: 'danger',
        title: 'Validation Failed',
        message: 'Name and email are strictly required for administrative enrollment.'
      });
      return;
    }

    if (!newEmail.includes('@')) {
      addToast({
        type: 'danger',
        title: 'Validation Failed',
        message: 'Please provide a valid corporate email format.'
      });
      return;
    }

    // The admin and Super Admin role can only be given by the Super Admin
    if (newRole === 'Admin' || newRole === 'SuperAdmin') {
      if (currentUser.role !== 'SuperAdmin') {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: Admin/SuperAdmin Grant Blocked',
          message: 'Only a Super Admin is authorized to assign the Admin or Super Admin role.'
        });
        return;
      }
    }

    // SuperAdmin should only be available to the Master Workspace Owner (mritunjoysingh@gmail.com).
    if (newRole === 'SuperAdmin') {
      if (!isDevelopmentTeam(newEmail)) {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: SuperAdmin Restrained',
          message: 'The SuperAdmin role is strictly tied to the Master Workspace Owner email address (mritunjoysingh@gmail.com).'
        });
        return;
      }
      if (currentUser.email !== 'mritunjoysingh@gmail.com' && !isDevelopmentTeam(currentUser.email)) {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: SuperAdmin Grant Blocked',
          message: 'Only the Master Workspace Owner (mritunjoysingh@gmail.com) can assign the SuperAdmin role.'
        });
        return;
      }
    }

    const newUser: AdminUser = {
      id: `USR-0${users.length + 1}`,
      name: newName,
      email: newEmail,
      role: newRole,
      status: 'ACTIVE',
      mfaEnabled: newMfa,
      lastLogin: 'Never'
    };

    setUsers(prev => [...prev, newUser]);
    setNewName('');
    setNewEmail('');
    
    addToast({
      type: 'success',
      title: 'Admin User Enrolled',
      message: `Successfully provisioned credentials for "${newName}" with role: ${newRole}.`
    });
  };

  const handleDeleteUser = (id: string, name: string) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && targetUser.email === 'mritunjoysingh@gmail.com') {
      addToast({
        type: 'danger',
        title: '❌ Operation Refused',
        message: 'Master Workspace Owner (mritunjoysingh@gmail.com) cannot be deleted or unlinked from the system.'
      });
      return;
    }

    setUsers(prev => prev.filter(u => u.id !== id));
    addToast({
      type: 'danger',
      title: 'Credentials Revoked',
      message: `Administrative credentials for "${name}" have been permanently wiped.`
    });
  };

  const handleToggleUserStatus = (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && targetUser.email === 'mritunjoysingh@gmail.com') {
      addToast({
        type: 'danger',
        title: '❌ Operation Refused',
        message: 'Master Workspace Owner (mritunjoysingh@gmail.com) cannot be suspended or locked out.'
      });
      return;
    }

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        addToast({
          type: nextStatus === 'ACTIVE' ? 'success' : 'warning',
          title: `Account Access Updated`,
          message: `User ${u.name} status reset to: ${nextStatus}.`
        });
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const handleUserRoleChange = (id: string, role: AdminRole) => {
    const targetUser = users.find(u => u.id === id);

    // If target is the owner, prevent demoting them
    if (targetUser && targetUser.email === 'mritunjoysingh@gmail.com' && role !== 'SuperAdmin') {
      addToast({
        type: 'danger',
        title: '❌ Lockout Protection Triggered',
        message: 'The Master Workspace Owner (mritunjoysingh@gmail.com) must retain the SuperAdmin role to prevent permanent workspace lockout.'
      });
      return;
    }

    // The admin and Super Admin role can only be given/taken by the Super Admin
    if (role === 'Admin' || role === 'SuperAdmin' || (targetUser && (targetUser.role === 'Admin' || targetUser.role === 'SuperAdmin'))) {
      if (currentUser.role !== 'SuperAdmin') {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: Admin/SuperAdmin Modification Blocked',
          message: 'Only a Super Admin is authorized to grant, revoke, or modify Admin or Super Admin roles.'
        });
        return;
      }
    }

    // SuperAdmin should only be available to the Master Workspace Owner (mritunjoysingh@gmail.com).
    if (role === 'SuperAdmin') {
      if (targetUser && !isDevelopmentTeam(targetUser.email)) {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: SuperAdmin Restrained',
          message: 'The SuperAdmin role is strictly tied to the Master Workspace Owner email address (mritunjoysingh@gmail.com).'
        });
        return;
      }
      if (currentUser.email !== 'mritunjoysingh@gmail.com' && !isDevelopmentTeam(currentUser.email)) {
        addToast({
          type: 'danger',
          title: '🔒 Access Denied: SuperAdmin Grant Blocked',
          message: 'Only the Master Workspace Owner (mritunjoysingh@gmail.com) can assign or promote accounts to the SuperAdmin role.',
        });
        return;
      }
    }

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        addToast({
          type: 'info',
          title: 'Role Authorization Changed',
          message: `User ${u.name} has been assigned role: ${role}.`
        });
        return { ...u, role };
      }
      return u;
    }));
  };

  const handleTogglePermission = (role: AdminRole, key: keyof Omit<RolePermission, 'role'>) => {
    setPermissions(prev => prev.map(p => {
      if (p.role === role) {
        const updatedVal = !p[key];
        addToast({
          type: 'success',
          title: 'Security Schema Recompiled',
          message: `Permission "${key}" for role ${role} set to: ${updatedVal.toString().toUpperCase()}`
        });
        return { ...p, [key]: updatedVal };
      }
      return p;
    }));
  };

  // 15-minute auto-revert timer for policy bypass guardrail
  useEffect(() => {
    if (!settings.bypassPolicyGuard || bypassTimerSeconds === null) return;
    if (bypassTimerSeconds <= 0) {
      setSettings(prev => ({ ...prev, bypassPolicyGuard: false }));
      setBypassTimerSeconds(null);
      addToast({
        type: 'success',
        title: '🛡️ Policy Shield Auto-Restored',
        message: 'The 15-minute bypass window expired. Sovereign Gateway protection has automatically re-engaged.',
        duration: 8000
      });
      return;
    }
    const timer = setInterval(() => {
      setBypassTimerSeconds(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.bypassPolicyGuard, bypassTimerSeconds, addToast]);

  const confirmEnableBypass = () => {
    setSettings(prev => ({ ...prev, bypassPolicyGuard: true }));
    setBypassTimerSeconds(900); // 15-minute auto-revert window (900 seconds)
    addToast({
      type: 'danger',
      title: '⚠️ CRITICAL: Policy Shield Bypassed!',
      message: 'All active agent governance guardrails have been disabled. A 15-minute auto-revert timer is active.',
      duration: 8000
    });
  };

  const handleToggleGlobalSetting = (key: keyof Pick<GlobalAdminSettings, 'bypassPolicyGuard' | 'mfaEnforcement' | 'disableAlertsGlobally'>) => {
    if (key === 'bypassPolicyGuard') {
      if (!settings.bypassPolicyGuard) {
        setShowBypassModal(true);
        return;
      } else {
        setSettings(prev => ({ ...prev, bypassPolicyGuard: false }));
        setBypassTimerSeconds(null);
        addToast({
          type: 'success',
          title: 'Shield Protection Restored',
          message: 'Gateway proxy rules are now fully operational and enforcing active policy intercept limits.',
          duration: 5000
        });
        return;
      }
    }

    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));

    if (key === 'disableAlertsGlobally') {
      setDisableAlertsGlobally(newVal);
      addToast({
        type: newVal ? 'warning' : 'success',
        title: newVal ? 'Alert Notifications Muted' : 'Alert Notifications Restored',
        message: newVal
          ? 'All background SLA warning toasts and risk telemetry banners are now silenced.'
          : 'Background gateway guardrails and policy violation warnings will notify active sessions.'
      });
    } else {
      addToast({
        type: 'info',
        title: 'MFA Enforcement Policies Updated',
        message: `Corporate multi-factor requirement has been ${newVal ? 'enforced globally' : 'relaxed'}.`
      });
    }
  };

  const handleTestAndSyncIAM = () => {
    if (iamProvider === 'NONE') {
      addToast({
        type: 'danger',
        title: 'No Identity Provider Selected',
        message: 'Please authorize an identity platform (e.g., Okta or Entra ID) before performing a directories sync session.'
      });
      return;
    }

    setIsSyncing(true);
    addToast({
      type: 'info',
      title: 'Initiating Federated Sync Handshake',
      message: `Establishing secure TLS connection & scanning directory group matching: "${iamSyncGroup}"...`
    });

    setTimeout(() => {
      setIsSyncing(false);

      // Check if we already merged. If not, add federated users
      const hasAdded = users.some(u => u.email.includes('-federated.gov'));
      if (!hasAdded) {
        const federatedUsers: AdminUser[] = [
          {
            id: `USR-SSO-Okta-01`,
            name: `${iamProvider === 'OKTA' ? 'Okta' : iamProvider === 'AZURE' ? 'Entra' : iamProvider === 'GOOGLE' ? 'Google Workspace' : 'Ping'} SecOps Audit Specialist`,
            email: `sso.audits@${iamProvider.toLowerCase()}-federated.gov`,
            role: 'Auditor',
            status: 'ACTIVE',
            mfaEnabled: true,
            lastLogin: 'Just synced'
          },
          {
            id: `USR-SSO-Okta-02`,
            name: `Director of Enterprise Governance`,
            email: `director.governance@${iamProvider.toLowerCase()}-federated.gov`,
            role: 'SuperAdmin',
            status: 'ACTIVE',
            mfaEnabled: true,
            lastLogin: 'Just synced'
          }
        ];
        setUsers(prev => [...prev, ...federatedUsers]);
        
        addToast({
          type: 'success',
          title: `SSO Federation Synced Successfully`,
          message: `OIDC / SAML connection verified. Imported 2 enterprise staff members matching user synced group: "${iamSyncGroup}".`
        });
      } else {
        addToast({
          type: 'success',
          title: `Enterprise IAM Re-Synced`,
          message: `Directory verified and updated. Total 2 federated identities synchronized successfully.`
        });
      }
    }, 1200);
  };

  // Counts
  const activeAdmins = users.filter(u => u.status === 'ACTIVE').length;
  const mfaCompliance = Math.round((users.filter(u => u.mfaEnabled).length / users.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in" id="admin-pillar-hub">
      {/* Settings bypass critical warning banner */}
      {settings.bypassPolicyGuard && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-450 flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <div>
              <span className="font-mono text-xs font-bold block">🚨 CRITICAL WARNING: CORE BYPASS ACTIVE</span>
              <p className="text-[10.5px] text-zinc-400 font-mono mt-0.5 leading-snug">
                The Policy Engine Shield is disabled. Agents can trigger any anomalous action without gateway halting.
              </p>
            </div>
          </div>
          <button 
            onClick={() => handleToggleGlobalSetting('bypassPolicyGuard')}
            className="bg-red-500 hover:bg-red-600 font-mono text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
          >
            Re-Enable Shield & Gatekeepers
          </button>
        </div>
      )}

      {/* Header Info Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-teal-450 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30 font-bold uppercase">
              Management Portal
            </span>
            <span className="text-zinc-600 text-xs font-mono">• Sector 07</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[#F0EEE6] tracking-tight mt-1">
            System Administration & Access (IAM)
          </h1>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            Secure configuration of administrator access rules, cryptographic roles, and bypass credentials.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex p-1 bg-zinc-950 border border-zinc-900 rounded-lg shrink-0">
          <button
            onClick={() => setActiveSubTab('iam')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'iam'
                ? 'bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25 shadow-sm'
                : 'text-zinc-500 hover:text-white border border-transparent'
            }`}
          >
            <Users size={14} />
            User Access
          </button>
          <button
            onClick={() => setActiveSubTab('roles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'roles'
                ? 'bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25 shadow-sm'
                : 'text-zinc-500 hover:text-white border border-transparent'
            }`}
          >
            <Key size={14} />
            Role Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25 shadow-sm'
                : 'text-zinc-500 hover:text-white border border-transparent'
            }`}
          >
            <SlidersHorizontal size={14} />
            Platform Config
          </button>
          <button
            onClick={() => setActiveSubTab('registry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'registry'
                ? 'bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25 shadow-sm'
                : 'text-zinc-500 hover:text-white border border-transparent'
            }`}
          >
            <Fingerprint size={14} />
            Visitor Registry
          </button>
        </div>
      </div>

      {/* Summary Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900">
          <span className="text-[10px] font-mono text-zinc-550 uppercase font-bold">Total Staff Enrolled</span>
          <div className="text-xl font-bold font-display text-white mt-1.5">{users.length} Users</div>
          <span className="text-[9px] font-mono text-zinc-600 block mt-1">Sector 07 Authority Matrix</span>
        </div>
        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900">
          <span className="text-[10px] font-mono text-teal-400 uppercase font-bold">Active Sessions</span>
          <div className="text-xl font-bold font-display text-teal-400 mt-1.5">{activeAdmins} Online</div>
          <span className="text-[9px] font-mono text-zinc-650 block mt-1">Synchronized via GaaS tokens</span>
        </div>
        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900">
          <span className="text-[10px] font-mono text-amber-500 uppercase font-bold">MFA Compliance Rate</span>
          <div className="text-xl font-bold font-display text-amber-500 mt-1.5">{mfaCompliance}% OK</div>
          <span className="text-[9px] font-mono text-zinc-600 block mt-1">Hardware MFA requirements enforced</span>
        </div>
        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-900">
          <span className="text-[10px] font-mono text-sky-400 uppercase font-bold">Audit Level</span>
          <div className="text-xl font-bold font-display text-sky-400 mt-1.5">[{settings.auditLogLevel}] Verbosity</div>
          <span className="text-[9px] font-mono text-zinc-650 block mt-1">Secure event telemetry frequency</span>
        </div>
      </div>

      {/* Main Tab Render Switcher */}
      {activeSubTab === 'iam' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="iam-views-container">
          {/* User management & registration column (Left 2 columns on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#09090B] border border-zinc-900 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 bg-zinc-950 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Fingerprint size={16} className="text-teal-450" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Authoritative User Directory
                  </span>
                </div>
                {/* Simple search filter */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-605" />
                  <input
                    type="text"
                    placeholder="Filter credentials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#121214] border border-zinc-850 rounded text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-805"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-400 font-mono">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 select-none">
                      <th className="p-3 pl-4">Name & Email</th>
                      <th className="p-3">Current Authorization Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">MFA Policy</th>
                      <th className="p-3">Last Active</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-950">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-600">
                          No administrators or credentials found matching selection schema.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-zinc-950 transition-colors">
                          <td className="p-3 pl-4">
                            <span className="font-sans font-semibold text-white block text-sm">{user.name}</span>
                            <span className="text-[10px] text-zinc-500">{user.email}</span>
                          </td>
                          <td className="p-3">
                            {(() => {
                              const isRoleChangeDisabled = !currentRolePerms.manageUsers || 
                                (currentUser.role !== 'SuperAdmin' && (user.role === 'SuperAdmin' || user.role === 'Admin'));
                              return (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUserRoleChange(user.id, e.target.value as AdminRole)}
                                  disabled={isRoleChangeDisabled}
                                  className={`bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs font-mono text-zinc-350 cursor-pointer focus:outline-none ${
                                    isRoleChangeDisabled ? 'opacity-55 cursor-not-allowed text-zinc-650' : ''
                                  }`}
                                >
                                  {(currentUser.role === 'SuperAdmin' || user.role === 'SuperAdmin') && (
                                    <option value="SuperAdmin">SuperAdmin</option>
                                  )}
                                  {(currentUser.role === 'SuperAdmin' || user.role === 'Admin') && (
                                    <option value="Admin">Admin</option>
                                  )}
                                  <option value="PolicyManager">PolicyManager</option>
                                  <option value="Auditor">Auditor</option>
                                  <option value="Operator">Operator</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            {user.status === 'ACTIVE' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-450 bg-emerald-950/40 border border-emerald-950/50 px-2 py-0.5 rounded">
                                <span className="w-1 h-1 rounded-full bg-emerald-450" />
                                ACTIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-450 bg-rose-950/30 border border-rose-950/30 px-2 py-0.5 rounded">
                                <span className="w-1 h-1 rounded-full bg-rose-450" />
                                SUSPENDED
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {user.mfaEnabled ? (
                              <span className="text-[10.5px] text-emerald-400 font-bold">✓ Hardware MFA</span>
                            ) : (
                              <span className="text-[10.5px] text-zinc-550">Not Set</span>
                            )}
                          </td>
                          <td className="p-3 text-zinc-500">
                            {user.lastLogin}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Full Profile Inspector button */}
                              <button
                                onClick={() => setInspectedUser(user)}
                                className="text-[10px] font-bold font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-500/30 hover:bg-cyan-900/50 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                title="View Registered User Profile & Security Details"
                              >
                                <Eye size={11} /> Details
                              </button>

                              {/* Suspend toggler */}
                              <button
                                onClick={() => {
                                  if (user.email === 'mritunjoysingh@gmail.com') {
                                    handleToggleUserStatus(user.id);
                                  } else {
                                    setStatusConfirmUser(user);
                                  }
                                }}
                                disabled={!currentRolePerms.manageUsers}
                                className={`text-[10px] font-bold uppercase transition-all px-2 py-1 rounded cursor-pointer border ${
                                  !currentRolePerms.manageUsers
                                    ? 'bg-zinc-950/40 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50'
                                    : user.status === 'ACTIVE'
                                      ? 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 border-zinc-850 hover:text-white'
                                      : 'bg-emerald-950 text-emerald-450 border-emerald-950/40 hover:bg-emerald-900'
                                }`}
                                title={!currentRolePerms.manageUsers ? "Requires User Management Permissions" : user.status === 'ACTIVE' ? "Suspend Authority" : "Re-activate Status"}
                              >
                                {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                              </button>

                              {/* Delete credential button */}
                              <button
                                onClick={() => {
                                  if (user.email === 'mritunjoysingh@gmail.com') {
                                    handleDeleteUser(user.id, user.name);
                                  } else {
                                    setDeleteConfirmUser(user);
                                  }
                                }}
                                disabled={!currentRolePerms.manageUsers}
                                className={`p-1 px-1.5 bg-zinc-950 border border-zinc-850 rounded transition-colors ${
                                  !currentRolePerms.manageUsers
                                    ? 'text-zinc-700 border-zinc-950 cursor-not-allowed opacity-40'
                                    : 'text-zinc-550 hover:text-red-400 hover:border-red-500/35 cursor-pointer'
                                }`}
                                title={!currentRolePerms.manageUsers ? "Requires User Management Permissions" : "Revoke Administrative Access"}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Enroll user side-form (Right 1 column on desktop) */}
          <div className="space-y-4">
            <div className="bg-[#09090B] border border-zinc-900 rounded-xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Plus size={16} className={!currentRolePerms.manageUsers ? "text-zinc-600" : "text-[#1D9E75]"} />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Enroll Authorized Admin
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mb-4 leading-relaxed">
                Add an additional authenticated security member to manage and audit specific security gates within AgentsGuardian.
              </p>

              {!currentRolePerms.manageUsers && (
                <div className="mb-4 p-3 bg-rose-950/20 border border-rose-950/40 rounded text-[10.5px] font-mono text-rose-400 select-none">
                  🔒 Onboarding Access Restricted: Your active role does not possess permissions to register new administrator accounts.
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="text-zinc-550 font-bold block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rachel Sterling"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={!currentRolePerms.manageUsers}
                    className={`w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-800 ${
                      !currentRolePerms.manageUsers ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-550 font-bold block mb-1">Corporate email address</label>
                  <input
                    type="email"
                    placeholder="e.g. r.sterling@guardian.gov"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={!currentRolePerms.manageUsers}
                    className={`w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-800 ${
                      !currentRolePerms.manageUsers ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-550 font-bold block mb-1">Default Platform Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AdminRole)}
                    disabled={!currentRolePerms.manageUsers}
                    className={`w-full bg-[#121214] border border-[#1F2E40] rounded p-2 text-zinc-350 focus:outline-none focus:border-zinc-805 cursor-pointer ${
                      !currentRolePerms.manageUsers ? 'opacity-50 cursor-not-allowed bg-zinc-950' : 'bg-[#121214]'
                    }`}
                  >
                    {currentUser.role === 'SuperAdmin' && (
                      <>
                        <option value="SuperAdmin">SuperAdmin (Master & Recovery)</option>
                        <option value="Admin">Admin (Workspace & Setup Mgr)</option>
                      </>
                    )}
                    <option value="PolicyManager">PolicyManager (Manage Rules)</option>
                    <option value="Auditor">Auditor (Read-Only Metrics)</option>
                    <option value="Operator">Operator (Kill-Switch Control)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-b border-zinc-950 my-2">
                  <div className="flex flex-col">
                    <span className="text-zinc-300 font-bold text-[11px]">Enforce hardware MFA</span>
                    <span className="text-[9px] text-zinc-550">Compels hardware security tokens</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMfa}
                    onChange={(e) => setNewMfa(e.target.checked)}
                    disabled={!currentRolePerms.manageUsers}
                    className={`w-4 h-4 rounded border-zinc-800 accent-teal-500 bg-zinc-950 cursor-pointer ${
                      !currentRolePerms.manageUsers ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!currentRolePerms.manageUsers}
                  className={`w-full py-2 border rounded font-bold transition-colors uppercase font-mono tracking-wider flex items-center justify-center gap-1.5 ${
                    !currentRolePerms.manageUsers
                      ? 'bg-zinc-950 border-zinc-900 text-zinc-650 cursor-not-allowed'
                      : 'bg-[#121214] border-zinc-850 text-[#1D9E75] hover:bg-zinc-900 cursor-pointer'
                  }`}
                >
                  <Plus size={14} />
                  Authorize Credentials
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'roles' && (
        <div className="bg-[#09090B] border border-zinc-900 rounded-xl overflow-hidden shadow-xl" id="role-matrix-container">
          <div className="p-4 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-teal-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Cryptographic Policy Capability Matrix
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono italic">
              *Togging capabilities alters security bypass permissions immediately
            </div>
          </div>

          {!canConfigureSystem && (
            <div className="mx-4 mt-4 p-3 bg-amber-950/20 border border-amber-950/40 rounded text-[10.5px] font-mono text-amber-500 select-none flex items-center gap-2">
              <Lock size={13} className="text-amber-500 shrink-0" />
              <span>Security Restriction: Role capabilities are read-only. Modifying rules requires <strong>SuperAdmin</strong> or <strong>Admin</strong> credentials.</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400 font-mono">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 select-none">
                  <th className="p-4 pl-6">Governance Admin Persona Role</th>
                  <th className="p-4 text-center">Configure Kill Switch</th>
                  <th className="p-4 text-center">Modify Policies</th>
                  <th className="p-4 text-center">View FinOps ROI</th>
                  <th className="p-4 text-center">Update Gateway SLAs</th>
                  <th className="p-4 text-center">Manage Administrators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950">
                {permissions.map((p) => (
                  <tr key={p.role} className="hover:bg-zinc-950/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-sans font-bold text-white">{p.role === 'SuperAdmin' ? '💎 SuperAdmin' : p.role === 'Admin' ? '👑 Admin' : p.role === 'PolicyManager' ? '👔 PolicyManager' : p.role === 'Auditor' ? '🔍 Auditor' : '⚙️ Operator'}</span>
                        <span className="text-[10px] text-zinc-500 max-w-sm mt-0.5 whitespace-pre-wrap leading-tight">
                          {p.role === 'SuperAdmin' && 'Complete root privileges across security models, network bypass keys, and administrator identities.'}
                          {p.role === 'Admin' && 'Full workspace control including user onboarding, directory management, and system configuration settings.'}
                          {p.role === 'PolicyManager' && 'Equipped to structure or amend LLM standard rules. Refines drift indices and blast limits.'}
                          {p.role === 'Auditor' && 'Read-only access across labor metrics, ROI ledgers, latency logs, and drift sentiment indicators.'}
                          {p.role === 'Operator' && 'Maintains system health metrics. Can initiate immediate kill-switch halting overrides.'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={p.configureKillSwitch}
                        onChange={() => handleTogglePermission(p.role, 'configureKillSwitch')}
                        disabled={!canConfigureSystem}
                        className={`w-4 h-4 rounded border-zinc-800 bg-zinc-905 accent-[#1D9E75] ${!canConfigureSystem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={p.modifyPolicies}
                        onChange={() => handleTogglePermission(p.role, 'modifyPolicies')}
                        disabled={!canConfigureSystem}
                        className={`w-4 h-4 rounded border-zinc-800 bg-zinc-905 accent-[#1D9E75] ${!canConfigureSystem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={p.viewFinancialMetrics}
                        onChange={() => handleTogglePermission(p.role, 'viewFinancialMetrics')}
                        disabled={!canConfigureSystem}
                        className={`w-4 h-4 rounded border-zinc-800 bg-zinc-905 accent-[#1D9E75] ${!canConfigureSystem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={p.updateGatewaySLAs}
                        onChange={() => handleTogglePermission(p.role, 'updateGatewaySLAs')}
                        disabled={!canConfigureSystem}
                        className={`w-4 h-4 rounded border-zinc-800 bg-zinc-905 accent-[#1D9E75] ${!canConfigureSystem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={p.manageUsers}
                        onChange={() => handleTogglePermission(p.role, 'manageUsers')}
                        disabled={!canConfigureSystem}
                        className={`w-4 h-4 rounded border-zinc-800 bg-zinc-905 accent-[#1D9E75] ${!canConfigureSystem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-zinc-950/70 border-t border-zinc-900 text-[11px] text-zinc-550 leading-relaxed font-mono flex items-center gap-2">
            <Lock size={12} className="text-zinc-650" />
            <span>
              Cryptographic tokens enforce role permissions natively at the gateway boundary layer. Session validation relies on RSA-HS-384 telemetry checks.
            </span>
          </div>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="bg-[#09090B] border border-zinc-900 rounded-xl p-6 shadow-xl space-y-6" id="global-platform-settings-container">
          <div className="flex items-center gap-2 border-b border-zinc-950 pb-3">
            <SlidersHorizontal size={16} className="text-teal-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Primary Platform Configuration & Security Controls
            </h3>
          </div>

          {!canConfigureSystem && (
            <div className="p-4 bg-rose-950/20 border border-rose-950/30 rounded-lg text-xs font-mono text-rose-450 select-none flex items-center gap-3">
              <Lock size={16} className="text-rose-400 shrink-0" />
              <div>
                <span className="font-bold uppercase block mb-0.5">🔒 Configuration Access Locked</span>
                <p className="text-[10.5px] text-zinc-450 leading-normal">
                  Your current assignment <strong>[{currentUser.role}]</strong> does not have permission to alter global systems or network configurations. Modifying variables requires <strong>SuperAdmin</strong> or <strong>Admin</strong> authorization.
                </p>
              </div>
            </div>
          )}

          <fieldset disabled={!canConfigureSystem} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side parameters */}
            <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-lg space-y-4">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
                Security Shields & Bypass Keys
              </span>

              {/* Guard policy dry run bypass toggle */}
              <div className="flex items-start justify-between p-3 bg-zinc-900/40 rounded border border-zinc-850">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-white block">Dry-Run Bypass Guard</span>
                  <p className="text-[10px] text-zinc-450 font-mono leading-relaxed">
                    Temporarily skip policy inspection (all endpoints allow pass-thru without HALT/Kill actions).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.bypassPolicyGuard}
                  onChange={() => handleToggleGlobalSetting('bypassPolicyGuard')}
                  className="w-5 h-5 rounded cursor-pointer accent-red-500 bg-zinc-900 border-zinc-800"
                />
              </div>

              {/* MFA Policy Enforcement */}
              <div className="flex items-start justify-between p-3 bg-zinc-900/40 rounded border border-zinc-850">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-white block">Strict Hardware MFA Enforcement</span>
                  <p className="text-[10px] text-zinc-455 font-mono leading-relaxed">
                    Revokes active operational authority for any admin users who have not configured hardware keys.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.mfaEnforcement}
                  onChange={() => handleToggleGlobalSetting('mfaEnforcement')}
                  className="w-5 h-5 rounded cursor-pointer accent-teal-500 bg-zinc-900 border-zinc-800"
                />
              </div>

              {/* Mute alerts / Disable warnings globally */}
              <div className="flex items-start justify-between p-3 bg-zinc-900/40 rounded border border-zinc-850">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-amber-500 block">Quiet Core SLA & Warn Alerts</span>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded px-1 uppercase font-bold">MUTE</span>
                  </div>
                  <p className="text-[10px] text-zinc-455 font-mono leading-relaxed">
                    Suppress all background SLA latency warning toasts and risk notifications with immediate enforcement.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.disableAlertsGlobally}
                  onChange={() => handleToggleGlobalSetting('disableAlertsGlobally')}
                  className="w-5 h-5 rounded cursor-pointer accent-amber-500 bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>

            {/* Right side parameters */}
            <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-lg space-y-5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
                Event Processing & Telemetry
              </span>

              {/* Audit level selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">Gateway Audit Log Verbosity</span>
                  <span className="text-zinc-500">[{settings.auditLogLevel}]</span>
                </div>
                <select
                  value={settings.auditLogLevel}
                  onChange={(e) => {
                    const level = e.target.value as GlobalAdminSettings['auditLogLevel'];
                    setSettings(prev => ({ ...prev, auditLogLevel: level }));
                    addToast({
                      type: 'info',
                      title: 'Telemetry Verbosity Tuned',
                      message: `Auditor logging channel updated to filter: [${level}]`
                    });
                  }}
                  className="w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-350 font-mono text-xs focus:outline-none cursor-pointer"
                >
                  <option value="DEBUG">DEBUG - Records all metadata and full agent prompt contexts</option>
                  <option value="INFO">INFO - Records authorized actions & latency metrics (Nominal)</option>
                  <option value="WARN">WARN - Records SLA violations and threshold warnings only</option>
                  <option value="ERROR">ERROR - Records terminated kill-switches and halted execution packets</option>
                </select>
              </div>

              {/* Session Expiration Hours slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">Administrator Session Expire Limit</span>
                  <span className="text-amber-500 font-bold">{settings.maxSessionTimeoutHrs} Hours</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="24"
                    step="1"
                    value={settings.maxSessionTimeoutHrs}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setSettings(prev => ({ ...prev, maxSessionTimeoutHrs: value }));
                    }}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#1D9E75]"
                  />
                </div>
                <p className="text-[9.5px] text-zinc-550 font-mono leading-none">
                  Compulsory re-authorization occurs once threshold limit is breached.
                </p>
              </div>
            </div>
          </div>

          {/* Network Safe IP Masking */}
          <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
                Network Restricted Shell Mask
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-950/20">
                <Globe size={11} className="text-emerald-400 shrink-0" />
                IP Whitelist Configured
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={settings.ipWhitelistRange}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(prev => ({ ...prev, ipWhitelistRange: val }));
                }}
                className="flex-1 bg-[#121214] border border-zinc-850 rounded p-2 font-mono text-xs text-zinc-300 focus:outline-none focus:border-zinc-800"
                placeholder="Comma separated subnet CIDRs or specific IPs"
              />
              <button
                onClick={() => {
                  addToast({
                    type: 'success',
                    title: 'IP Firewall Schema Appended',
                    message: `Routing mask successfully restrict to:\n${settings.ipWhitelistRange}`
                  });
                }}
                className="px-4 py-2 bg-[#121214] hover:bg-zinc-900 border border-zinc-850 font-mono text-xs font-bold text-white rounded cursor-pointer transition-colors"
              >
                Apply Perimeter Rules
              </button>
            </div>
            <p className="text-[10px] text-zinc-550 font-mono leading-relaxed">
              Restricts access to AgentsGuardian platform to request queries matching the designated CIDR blocks. Default values represent internal GaaS orchestrator gateways.
            </p>
          </div>

          {/* Enterprise IAM Identity Platform Federation */}
          <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-lg space-y-4" id="federated-iam-integration-block">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest block font-bold">
                  Enterprise SSO & Federated IAM Link
                </span>
                <p className="text-[10px] text-zinc-500 font-mono leading-none">
                  Authorize federated single-sign-on (SSO) platforms to map corporate employee lists to Security Roles.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold uppercase ${
                  iamProvider === 'NONE' 
                    ? 'bg-zinc-900 text-zinc-500 border-zinc-850' 
                    : 'bg-indigo-950/40 text-indigo-400 border-indigo-950/40'
                }`}>
                  {iamProvider === 'NONE' ? 'Disconnected' : `${iamProvider} ACTIVE`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              {/* Selector */}
              <div className="space-y-2">
                <label className="text-zinc-550 font-bold block">Active IAM Provider</label>
                <select
                  value={iamProvider}
                  onChange={(e) => {
                    const provider = e.target.value as typeof iamProvider;
                    setIamProvider(provider);
                    if (provider !== 'NONE') {
                      addToast({
                        type: 'info',
                        title: 'IAM Gateway Selection',
                        message: `Switched identity federation strategy to: [${provider}]. Form attributes updated.`
                      });
                    }
                  }}
                  className="w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-300 font-mono text-xs focus:outline-none cursor-pointer"
                >
                  <option value="NONE">🔐 No IAM Gateway Linked (Internal Credentials Only)</option>
                  <option value="OKTA">🟢 Okta Identity SaaS Cloud Connect</option>
                  <option value="AZURE">🔵 Microsoft Entra ID (Azure AD Premium)</option>
                  <option value="GOOGLE">🔴 Google Workspace Admin Console SDK</option>
                  <option value="PING">🟣 Ping Identity Enterprise Federation Suite</option>
                </select>
                <div className="text-[9.5px] text-zinc-550 leading-relaxed mt-1">
                  Enabling maps authentication verification directly to centralized active tokens.
                </div>
              </div>

              {/* Dynamic configs display */}
              {iamProvider !== 'NONE' ? (
                <>
                  <div className="space-y-4 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-zinc-550 font-bold block">
                        {iamProvider === 'AZURE' ? 'Azure Directory Tenant ID' : iamProvider === 'GOOGLE' ? 'Enterprise Domain' : 'OIDC Issuer Discovery URL'}
                      </label>
                      <input
                        type="text"
                        value={iamProvider === 'AZURE' ? iamTenantId : iamIssuerUrl}
                        onChange={(e) => iamProvider === 'AZURE' ? setIamTenantId(e.target.value) : setIamIssuerUrl(e.target.value)}
                        className="w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-300 focus:outline-none focus:border-zinc-800"
                        placeholder="e.g. auth.coporation.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-550 font-bold block">OAuth OIDC Client Application Key (Client ID)</label>
                      <input
                        type="text"
                        value={iamClientId}
                        onChange={(e) => setIamClientId(e.target.value)}
                        className="w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-300 focus:outline-none focus:border-zinc-800"
                        placeholder="e.g. client_id_092h83bf"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-550 font-bold block">IAM Directory User Hub Group Synchronization List</label>
                      <input
                        type="text"
                        value={iamSyncGroup}
                        onChange={(e) => setIamSyncGroup(e.target.value)}
                        className="w-full bg-[#121214] border border-zinc-850 rounded p-2 text-zinc-300 focus:outline-none focus:border-zinc-800"
                        placeholder="e.g. SecurityAdmins, Auditors"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-zinc-900/30 rounded border border-zinc-850 h-10 mt-5">
                      <span className="text-[10.5px] text-zinc-330 font-bold">Restrict to SSO-Only (Disable local DB)</span>
                      <input
                        type="checkbox"
                        checked={iamSsoOnly}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setIamSsoOnly(val);
                          addToast({
                            type: val ? 'warning' : 'success',
                            title: val ? 'Local Credentials Muted' : 'Local Override Guard Recovered',
                            message: val 
                              ? 'Root local bypass login is rejected; all users must route through Identity Portal auth tokens.' 
                              : 'Local developer backend accounts are allowed for contingency overrides.'
                          });
                        }}
                        className="w-4 h-4 rounded cursor-pointer accent-indigo-500 bg-zinc-900 border-zinc-800"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 flex flex-col items-center justify-center p-6 bg-zinc-900/10 rounded border border-dashed border-zinc-900 text-center">
                  <Lock size={20} className="text-zinc-700 mb-1" />
                  <span className="text-zinc-500 font-bold">No Enterprise IAM Connected</span>
                  <p className="text-[10px] text-zinc-600 max-w-sm mt-1 leading-snug">
                    Administrator accounts are managed within the local database directory above. Use OAuth/OIDC credentials to lock/link the workspace with directory profiles.
                  </p>
                </div>
              )}
            </div>

            {/* Save and Sync Trigger Strips */}
            {iamProvider !== 'NONE' && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 border-t border-zinc-900">
                <button
                  onClick={() => {
                    addToast({
                      type: 'success',
                      title: 'IAM Federation Schemas Saved',
                      message: `Successfully updated configurations with OIDC client: "${iamClientId}". SAML assertion tokens linked.`
                    });
                  }}
                  className="px-4 py-2 bg-[#121214] hover:bg-zinc-900 border border-zinc-850 font-mono text-xs font-bold text-zinc-350 hover:text-white rounded cursor-pointer transition-colors"
                >
                  Save Identity Connector Configurations
                </button>
                <button
                  onClick={handleTestAndSyncIAM}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-indigo-950/60 hover:bg-indigo-900/40 border border-indigo-900/60 font-mono text-xs font-bold text-indigo-400 rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} className={`shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing Directory Enterprise Users...' : 'Sync & Update OIDC Groups'}
                </button>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    )}

    {activeSubTab === 'registry' && (
      <div className="space-y-6 mt-6 animate-in fade-in duration-200" id="visitor-registry-subtab-panel">
        <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-black text-white text-base flex items-center gap-2">
                <Fingerprint className="text-teal-400" size={17} />
                Captured Admins & Visitor Registry Logs
              </h3>
              <p className="text-[11px] font-mono text-zinc-400 leading-relaxed mt-1">
                A secure real-time audit ledger logging all operators and visitors registered onto this published dashboard node. 
              </p>
            </div>
            
            <button
              onClick={() => {
                // Keep only the root and default initial admins
                setUsers(users.slice(0, 5));
                addToast({
                  type: 'warning',
                  title: '🪵 Visitor Registry Purged',
                  message: 'Successfully cleared custom registered guests from transient browser memory.'
                });
              }}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-400 text-[10.5px] font-mono font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              type="button"
            >
              Clear Custom Registrations
            </button>
          </div>

          <div className="pt-2">
            <div className="overflow-x-auto border border-zinc-900 rounded-xl bg-[#090E17]">
              <table className="w-full text-left text-xs text-zinc-300 font-sans border-collapse">
                <thead>
                  <tr className="bg-zinc-950/90 border-b border-zinc-900 text-[10px] uppercase font-mono tracking-wider font-extrabold text-zinc-500">
                    <th className="p-4">Staff Profile & Credentials</th>
                    <th className="p-4">Access Key ID</th>
                    <th className="p-4">IAM Assigned Privilege</th>
                    <th className="p-4">Identity Status</th>
                    <th className="th-actions p-4 text-right">Administrative Clearance actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {users.map((usr) => {
                    const isRoot = usr.email === 'mritunjoysingh@gmail.com';
                    const isCustomReg = usr.id.startsWith('USR-REQ-') || usr.lastLogin.includes('Registered') || usr.lastLogin.includes('Captured') || (usr.id.startsWith('USR-0') && parseInt(usr.id.replace('USR-0', '').replace('USR-', ''), 10) > 4);
                    
                    return (
                      <tr key={usr.id} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-mono font-black text-xs border ${
                              isRoot 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                : isCustomReg 
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                                : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'
                            }`}>
                              {usr.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-101 flex items-center gap-1.5">
                                {usr.name}
                                {isRoot && (
                                  <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1 rounded-sm border border-amber-500/20 font-mono tracking-widest uppercase">
                                    Root Anchor
                                  </span>
                                )}
                                {isCustomReg && (
                                  <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1 rounded-sm border border-teal-500/20 font-mono tracking-widest uppercase">
                                    Captured Signup
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500 block leading-tight mt-0.5">{usr.email}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-4 font-mono text-[10.5px] text-zinc-400">
                          {usr.id}
                        </td>
                        
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border leading-none inline-block ${
                            usr.role === 'SuperAdmin' 
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                              : usr.role === 'Admin' 
                              ? 'bg-indigo-550/10 text-indigo-400 border-indigo-500/20' 
                              : usr.role === 'PolicyManager' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                              : usr.role === 'Operator' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-zinc-800 text-zinc-400 border-zinc-800'
                          }`}>
                            {usr.role}
                          </span>
                        </td>
                        
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full inline-block ${usr.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[10.5px] font-mono uppercase font-black text-slate-300">
                              {usr.status}
                            </span>
                          </div>
                        </td>
                        
                        <td className="p-4 text-right space-x-2">
                          {/* Toggle Status */}
                          <button
                            onClick={() => {
                              if (usr.id === currentUser.id) {
                                addToast({
                                  type: 'danger',
                                  title: '🔒 Self-Suspension Preventive',
                                  message: 'You cannot suspend your own active administrative session tokens.'
                                });
                                return;
                              }
                              setUsers(prev => prev.map(u => {
                                if (u.id === usr.id) {
                                  const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                                  addToast({
                                    type: nextStatus === 'ACTIVE' ? 'success' : 'warning',
                                    title: nextStatus === 'ACTIVE' ? '🔑 User Session Reinstated' : '🔒 User Session Suspended',
                                    message: `Administrative access for "${u.name}" has been set to ${nextStatus}.`
                                  });
                                  return { ...u, status: nextStatus };
                                }
                                return u;
                              }));
                            }}
                            disabled={isRoot}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase border cursor-pointer transition-all ${
                              isRoot 
                                ? 'bg-zinc-900 border-zinc-850 text-zinc-600 cursor-not-allowed' 
                                : usr.status === 'ACTIVE'
                                ? 'bg-orange-950/20 hover:bg-orange-950/40 border-orange-500/20 hover:border-orange-500/40 text-orange-400'
                                : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400'
                            }`}
                            type="button"
                          >
                            {usr.status === 'ACTIVE' ? 'Suspend' : 'Reinstate'}
                          </button>

                          {/* MFA rotate key */}
                          <button
                            onClick={() => {
                              addToast({
                                type: 'success',
                                title: '🔑 Hardware MFA Rotated',
                                message: `Successfully rotated cryptographic MFA keys for "${usr.name}". Generated fresh base32 seed.`
                              });
                            }}
                            className="px-2 py-1 rounded bg-teal-950/20 hover:bg-teal-950/40 border border-teal-500/20 hover:border-teal-500/40 text-teal-400 text-[10px] font-mono font-bold cursor-pointer transition-all"
                            type="button"
                          >
                            Rotate MFA
                          </button>

                          {/* Purge user */}
                          <button
                            onClick={() => {
                              if (usr.id === currentUser.id) {
                                addToast({
                                  type: 'danger',
                                  title: '🔒 Revocation Blocked',
                                  message: 'You cannot de-enroll your own active administrative credentials.'
                                });
                                return;
                              }
                              if (isRoot) return;
                              
                              setUsers(prev => prev.filter(u => u.id !== usr.id));
                              addToast({
                                type: 'danger',
                                title: '❌ Administrative De-enrollment',
                                message: `Successfully cleared registry and credentials mapping for "${usr.name}". Access cards revoked.`
                              });
                            }}
                            disabled={isRoot}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase border cursor-pointer transition-all ${
                              isRoot 
                                ? 'bg-zinc-900 border-zinc-850 text-zinc-600 cursor-not-allowed' 
                                : 'bg-red-950/20 hover:bg-red-950/40 border-red-500/20 hover:border-red-500/40 text-red-400'
                            }`}
                            type="button"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 p-3 bg-[#0A0E17]/50 border border-zinc-900 rounded-lg flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>LEDGER SYNC CODE: SYNC_SEC_ACTIVE</span>
              <span className="text-zinc-400">Total Registered Identities count: {users.length}</span>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* REGISTERED USER PROFILE INSPECTOR MODAL FOR SUPER ADMIN */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0C121D] border border-[#1F2E40] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-[#090E17] border-b border-[#1F2E40] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/20 border border-[#1D9E75]/40 flex items-center justify-center text-[#1D9E75] font-mono font-black text-sm">
                  {inspectedUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-sans">{inspectedUser.name}</h3>
                    <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                      {inspectedUser.id}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">{inspectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedUser(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs">
              {/* Overview Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#111E2E] border border-[#1F2E40] rounded-xl space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Role Privilege</span>
                  <div className="text-xs font-bold text-[#1D9E75] flex items-center gap-1">
                    <Shield size={12} /> {inspectedUser.role}
                  </div>
                </div>

                <div className="p-3 bg-[#111E2E] border border-[#1F2E40] rounded-xl space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Account Status</span>
                  <div>
                    {inspectedUser.status === 'ACTIVE' ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Check size={12} /> ACTIVE
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                        <AlertTriangle size={12} /> SUSPENDED
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-[#111E2E] border border-[#1F2E40] rounded-xl space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">MFA Hardware</span>
                  <div className="text-xs font-bold text-teal-300 flex items-center gap-1">
                    <Key size={12} /> {inspectedUser.mfaEnabled ? 'Enforced' : 'Optional'}
                  </div>
                </div>

                <div className="p-3 bg-[#111E2E] border border-[#1F2E40] rounded-xl space-y-1">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Last Activity</span>
                  <div className="text-[11px] font-bold text-zinc-300 truncate">
                    {inspectedUser.lastLogin}
                  </div>
                </div>
              </div>

              {/* Detailed Technical Metadata */}
              <div className="bg-[#090E17] border border-[#1F2E40] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Fingerprint size={14} className="text-cyan-400" /> Administrative Security Profile
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-zinc-400">
                  <div>
                    <span className="text-zinc-550 block text-[9.5px]">Registration Identity Provider:</span>
                    <span className="text-white font-bold">
                      {inspectedUser.email.endsWith('@gmail.com') ? 'Google OAuth 2.0 / SSO' : 'Corporate Identity Provider (GaaS)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-550 block text-[9.5px]">Master Tenant Isolation Key:</span>
                    <span className="text-cyan-300 font-bold">
                      {`tenant-org-${inspectedUser.id.toLowerCase()}-sec`}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-550 block text-[9.5px]">Assigned Clearance Level:</span>
                    <span className="text-emerald-400 font-bold">
                      {inspectedUser.role === 'SuperAdmin' ? 'Level 5 (Root Control)' : inspectedUser.role === 'Admin' ? 'Level 4 (Policy Write)' : 'Level 2 (Operator/Audit)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-550 block text-[9.5px]">Session Token Rotation:</span>
                    <span className="text-zinc-300 font-bold">Automated 4-Hour OAuth Refresh</span>
                  </div>
                </div>
              </div>

              {/* Permissions Matrix Checklist for this user */}
              <div className="bg-[#090E17] border border-[#1F2E40] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Lock size={14} className="text-[#1D9E75]" /> Effective Role Permissions Matrix
                </h4>

                {(() => {
                  const perm = permissions.find(p => p.role === inspectedUser.role) || {
                    configureKillSwitch: false,
                    modifyPolicies: false,
                    viewFinancialMetrics: false,
                    updateGatewaySLAs: false,
                    manageUsers: false
                  };
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-zinc-900">
                        <span>Kill-Switch Execution:</span>
                        <span className={perm.configureKillSwitch ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                          {perm.configureKillSwitch ? '✓ ALLOWED' : '✕ DENIED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-zinc-900">
                        <span>Policy Configuration:</span>
                        <span className={perm.modifyPolicies ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                          {perm.modifyPolicies ? '✓ ALLOWED' : '✕ DENIED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-zinc-900">
                        <span>Financial Value Metrics:</span>
                        <span className={perm.viewFinancialMetrics ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                          {perm.viewFinancialMetrics ? '✓ ALLOWED' : '✕ DENIED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-zinc-900">
                        <span>User & Credential Mgmt:</span>
                        <span className={perm.manageUsers ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                          {perm.manageUsers ? '✓ ALLOWED' : '✕ DENIED'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Quick Admin Actions inside modal */}
              {currentUser.role === 'SuperAdmin' && (
                <div className="pt-2 border-t border-[#1F2E40] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Change Role:</span>
                    <select
                      value={inspectedUser.role}
                      onChange={(e) => {
                        handleUserRoleChange(inspectedUser.id, e.target.value as AdminRole);
                        setInspectedUser(prev => prev ? { ...prev, role: e.target.value as AdminRole } : null);
                      }}
                      className="bg-[#111E2E] border border-[#1F2E40] text-xs font-bold text-white rounded px-2.5 py-1 focus:outline-none cursor-pointer"
                    >
                      <option value="SuperAdmin">SuperAdmin</option>
                      <option value="Admin">Admin</option>
                      <option value="PolicyManager">PolicyManager</option>
                      <option value="Auditor">Auditor</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordTargetUser(inspectedUser);
                      }}
                      className="px-3 py-1.5 rounded text-xs font-bold border cursor-pointer transition-colors bg-teal-950/40 hover:bg-teal-900/60 text-teal-300 border-teal-500/40 flex items-center gap-1.5"
                    >
                      <KeyRound size={12} /> Reset Password
                    </button>

                    <button
                      onClick={() => {
                        handleToggleUserStatus(inspectedUser.id);
                        setInspectedUser(prev => prev ? { ...prev, status: prev.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : null);
                      }}
                      className="px-3 py-1.5 rounded text-xs font-bold border cursor-pointer transition-colors bg-zinc-900 hover:bg-zinc-800 text-amber-300 border-amber-500/30"
                    >
                      {inspectedUser.status === 'ACTIVE' ? 'Suspend Account' : 'Re-Activate Account'}
                    </button>

                    <button
                      onClick={() => setInspectedUser(null)}
                      className="px-4 py-1.5 rounded text-xs font-bold bg-[#1D9E75] hover:bg-[#15805d] text-white transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete User Credentials */}
      <ConfirmationModal
        isOpen={Boolean(deleteConfirmUser)}
        onClose={() => setDeleteConfirmUser(null)}
        onConfirm={() => {
          if (deleteConfirmUser) {
            handleDeleteUser(deleteConfirmUser.id, deleteConfirmUser.name);
            setDeleteConfirmUser(null);
          }
        }}
        title={`Revoke Credentials for ${deleteConfirmUser?.name}?`}
        description={`This will permanently remove administrative credentials for ${deleteConfirmUser?.email}. Access token authorization will be immediately terminated across all active sessions.`}
        confirmLabel="Revoke Credentials"
        cancelLabel="Keep User Account"
        severity="danger"
        badgeText="PERMANENT DELETION"
        detailsList={[
          `User: ${deleteConfirmUser?.name} (${deleteConfirmUser?.email})`,
          `Role: ${deleteConfirmUser?.role}`,
          "Active OAuth session tokens will be invalidated immediately"
        ]}
      />

      {/* Confirmation Modal: Toggle User Account Status */}
      <ConfirmationModal
        isOpen={Boolean(statusConfirmUser)}
        onClose={() => setStatusConfirmUser(null)}
        onConfirm={() => {
          if (statusConfirmUser) {
            handleToggleUserStatus(statusConfirmUser.id);
            setStatusConfirmUser(null);
          }
        }}
        title={`${statusConfirmUser?.status === 'ACTIVE' ? 'Suspend' : 'Re-Activate'} Account for ${statusConfirmUser?.name}?`}
        description={statusConfirmUser?.status === 'ACTIVE'
          ? `Suspending ${statusConfirmUser?.name} (${statusConfirmUser?.email}) will temporarily block API key creation and system configuration changes.`
          : `Re-activating ${statusConfirmUser?.name} will restore account access permissions.`
        }
        confirmLabel={statusConfirmUser?.status === 'ACTIVE' ? 'Suspend Account' : 'Re-Activate Account'}
        cancelLabel="Cancel"
        severity={statusConfirmUser?.status === 'ACTIVE' ? 'warning' : 'info'}
        badgeText="ACCOUNT ACCESS UPDATE"
      />

      {/* Confirmation Modal: Bypass Policy Guard */}
      <ConfirmationModal
        isOpen={showBypassModal}
        onClose={() => setShowBypassModal(false)}
        onConfirm={() => {
          confirmEnableBypass();
          setShowBypassModal(false);
        }}
        title="⚠️ Bypass Active Policy Guardrails?"
        description="Bypassing policy guardrails puts the Gateway into Dry-Run mode. Real-time interceptors and kill-switches will BE DISABLED for all connected AI agents. A 15-minute auto-revert window will automatically re-engage protection if left active."
        confirmLabel="BYPASS GUARDRAILS"
        cancelLabel="Keep Guardrails Active"
        typeToConfirm="BYPASS"
        severity="danger"
        badgeText="SECURITY BYPASS CRITICAL"
        detailsList={[
          "All active policy interceptors will be set to DRY-RUN mode",
          "Automated kill-switch signals will be suppressed",
          "15-minute auto-revert timer will automatically re-engage protection"
        ]}
      />

      {/* Admin Password Re-Keying / Reset Modal */}
      {passwordTargetUser && (
        <UpdatePasswordModal
          isOpen={Boolean(passwordTargetUser)}
          onClose={() => setPasswordTargetUser(null)}
          currentUser={currentUser}
          targetUser={passwordTargetUser}
          addToast={addToast}
        />
      )}
    </div>
  );
}
