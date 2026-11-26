/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Copy, Check, X, AlertCircle, RefreshCw, Sparkles, Send } from 'lucide-react';
import { AdminUser, AdminRole } from '../types';

interface ProvisionUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: AdminUser | null;
  currentUser: AdminUser;
  onProvisionSuccess: (updatedUser: AdminUser, otp: string) => void;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
}

export default function ProvisionUserModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  onProvisionSuccess,
  addToast
}: ProvisionUserModalProps) {
  if (!isOpen || !targetUser) return null;

  const [approvedRole, setApprovedRole] = useState<AdminRole>(targetUser.role || 'Operator');
  const [customOtp, setCustomOtp] = useState<string>(() => generateRandomOtp());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionedOtp, setProvisionedOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  function generateRandomOtp() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OTP-${part1}-${part2}`;
  }

  const handleRegenerate = () => {
    setCustomOtp(generateRandomOtp());
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const sessionToken = localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/approve-provision`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          approvedRole,
          customOtp: customOtp.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to approve registration and provision credentials.');
        setIsSubmitting(false);
        return;
      }

      setProvisionedOtp(data.oneTimePassword);
      onProvisionSuccess(data.user, data.oneTimePassword);

      addToast({
        type: 'success',
        title: '🔑 Credentials Provisioned',
        message: `Account for ${targetUser.name} (${targetUser.email}) approved as ${approvedRole} with One-Time Password.`
      });
    } catch (err: any) {
      setError(err?.message || 'Network error connecting to IAM security service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!provisionedOtp) return;
    const loginUrl = window.location.origin;
    const text = `AgentsGuardian Operator Access Credentials:
Email / ID: ${targetUser.email}
One-Time Password: ${provisionedOtp}
Access Portal: ${loginUrl}
Note: You will be prompted to set your permanent password upon your first sign-in.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast({
      type: 'info',
      title: '📋 Credentials Copied',
      message: 'One-time credentials copied to clipboard.'
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="provision-user-modal">
      <div 
        className="w-full max-w-lg bg-[#0C121D] border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-950/40 via-zinc-900 to-zinc-900 border-b border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                {provisionedOtp ? 'One-Time Credentials Issued' : 'Approve & Provision User Credentials'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Super Admin IAM Governance Gate
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            id="provision-modal-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-zinc-300">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-lg flex items-center gap-2 text-red-400 font-mono text-[11px]">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!provisionedOtp ? (
            <form onSubmit={handleApprove} className="space-y-4">
              {/* Target User Summary Card */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-[#1F2E40] space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white text-sm">{targetUser.name}</div>
                    <div className="text-[11px] text-teal-400 font-mono">{targetUser.email}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    PENDING APPROVAL
                  </span>
                </div>
                {targetUser.organization && (
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-zinc-500 font-mono">Org:</span> {targetUser.organization}
                  </div>
                )}
                {targetUser.registrationNotes && (
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-zinc-500 font-mono">Purpose:</span> {targetUser.registrationNotes}
                  </div>
                )}
              </div>

              {/* Role Assignment */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-zinc-400 font-mono uppercase tracking-wider block">
                  Authoritative Role Assignment
                </label>
                <select
                  value={approvedRole}
                  onChange={(e) => setApprovedRole(e.target.value as AdminRole)}
                  className="w-full bg-black/40 border border-[#1F2E40] rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-teal-500"
                  id="provision-role-select"
                >
                  <option value="Operator">Operator (Operational monitoring & telemetry)</option>
                  <option value="Auditor">Auditor (Compliance verification & read-only)</option>
                  <option value="PolicyManager">PolicyManager (Guardrail & rule configuration)</option>
                  <option value="Admin">Admin (System operations & user management)</option>
                </select>
                <p className="text-[10px] text-zinc-500">
                  Select the approved role. (SuperAdmin assignment requires primary owner credentials).
                </p>
              </div>

              {/* One-Time Password Generator */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10.5px] font-bold text-zinc-400 font-mono uppercase tracking-wider block">
                    Generated One-Time Password (OTP)
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="text-[10.5px] font-mono text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                    id="provision-regenerate-otp"
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={customOtp}
                    onChange={(e) => setCustomOtp(e.target.value)}
                    className="w-full bg-black/60 border border-teal-500/40 rounded-lg px-3 py-2.5 text-sm font-mono text-teal-300 font-bold tracking-wider focus:outline-none focus:border-teal-400"
                    id="provision-otp-input"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  This single-use code allows initial activation. The operator must create their permanent password immediately upon login.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-[#1F2E40] bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20"
                  id="provision-confirm-submit-btn"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      Confirm & Provision Credentials
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Success & Copy Screen */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                  <Check size={20} />
                </div>
                <h4 className="text-sm font-bold text-white font-display">
                  Account Successfully Provisioned!
                </h4>
                <p className="text-[11px] text-zinc-400">
                  User <strong className="text-white">{targetUser.name}</strong> ({targetUser.email}) is now active with role <strong className="text-teal-400">{approvedRole}</strong>.
                </p>
              </div>

              {/* Credentials Box */}
              <div className="p-4 rounded-xl bg-black/60 border border-teal-500/30 space-y-3 font-mono">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">Corporate Login ID:</span>
                  <span className="text-white font-bold">{targetUser.email}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">Temporary One-Time Password:</span>
                  <span className="text-teal-300 font-bold bg-teal-950/50 px-2 py-1 rounded border border-teal-500/30 text-xs tracking-wider">
                    {provisionedOtp}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">Status:</span>
                  <span className="text-amber-400">Must Reset Password On First Login</span>
                </div>
              </div>

              {/* Copy CTA */}
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20"
                id="provision-copy-btn"
              >
                {copied ? (
                  <>
                    <Check size={14} /> Credentials Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Provisioning Details
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-zinc-400 hover:text-white underline transition-colors"
                >
                  Close and return to IAM Directory
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
