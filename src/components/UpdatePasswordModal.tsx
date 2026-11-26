/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, ShieldAlert, X, Send, UserCheck } from 'lucide-react';
import { AdminUser } from '../types';

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AdminUser;
  targetUser?: AdminUser | null;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
}

export default function UpdatePasswordModal({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  addToast
}: UpdatePasswordModalProps) {
  const effectiveTarget = targetUser || currentUser;
  const isAdminReset = Boolean(targetUser && targetUser.id !== currentUser.id);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const sessionToken = localStorage.getItem('ag_session_token') || sessionStorage.getItem('ag_session_token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
      headers['x-admin-session'] = sessionToken;
    }

    // MODE 1: Admin-Initiated Reset for Another User
    if (isAdminReset) {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(effectiveTarget.id)}/reset-password`, {
          method: 'POST',
          headers
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to dispatch administrative password reset.');
          setIsSubmitting(false);
          return;
        }

        const msg = data.message || `A password reset has been sent to ${effectiveTarget.email}`;
        setSuccessMessage(msg);
        addToast({
          type: 'success',
          title: '🔒 Password Reset Dispatched',
          message: `A password reset link has been dispatched to ${effectiveTarget.email}. Acting admin session remains unchanged.`
        });

        setTimeout(() => {
          handleClose();
        }, 1800);
      } catch (err: any) {
        setError(err?.message || 'Network error connecting to IAM security service.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // MODE 2: Self-Service Password Change for Authenticated User
    if (!newPassword) {
      setError('Please provide a new administrative password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify your entries.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update administrative password.');
        setIsSubmitting(false);
        return;
      }

      if (effectiveTarget) {
        effectiveTarget.mustResetPassword = false;
      }
      currentUser.mustResetPassword = false;

      setSuccessMessage('Administrative credentials successfully re-keyed.');
      addToast({
        type: 'success',
        title: '🔒 Administrative Password Updated',
        message: `Security key updated successfully for ${currentUser.email}.`
      });

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Network error connecting to security service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="update-password-modal">
      <div 
        className="fixed inset-0 cursor-default" 
        onClick={handleClose} 
      />

      <div className="relative w-full max-w-md bg-[#0D1520] border border-[#1F2E40] rounded-2xl shadow-2xl overflow-hidden z-10 font-sans animate-scale-in">
        {/* Modal Header */}
        <div className="p-5 bg-[#111E2E] border-b border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isAdminReset ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-teal-500/10 border-teal-500/30 text-teal-400'}`}>
              {isAdminReset ? <ShieldAlert size={18} /> : <KeyRound size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide" id="modal-title">
                {isAdminReset ? 'Admin Password Reset Dispatch' : 'Update Administrative Password'}
              </h3>
              <p className="text-[11px] font-mono text-zinc-400">
                {effectiveTarget.email} • <span className="text-teal-400 font-bold">{effectiveTarget.role}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Security Notice / Context */}
          {isAdminReset ? (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] font-mono text-amber-200/90 leading-relaxed space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">Administrative Credential Governance:</span>
                  <p className="mt-1 text-zinc-300">
                    Dispatching a reset generates a cryptographic token sent out-of-band to <strong className="text-white">{effectiveTarget.email}</strong> and forces <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">mustResetPassword: true</code> on the target account.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[10px] text-zinc-400 flex items-center gap-1.5">
                <UserCheck size={12} className="text-teal-400" />
                <span>Acting Admin: <strong className="text-zinc-300">{currentUser.email}</strong> (your own credentials remain untouched).</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span>Updating your administrative password updates cryptographic session keys across all active governance modules.</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-start gap-2" id="reset-success-alert">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2" id="reset-error-alert">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* If Self-Service Mode: Render Password Input Fields */}
          {!isAdminReset && (
            <>
              {/* Current Password Field */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                  Current Password (Optional if initial seed)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock size={13} />
                  </span>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="••••••••••••"
                    className="w-full text-xs font-sans bg-black/50 border border-[#1F2E40] rounded-lg pl-9.5 pr-10 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    New Administrative Password
                  </label>
                  <span className="text-[9px] font-mono text-zinc-500">Min 12 characters</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <KeyRound size={13} />
                  </span>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="••••••••••••"
                    className="w-full text-xs font-sans bg-black/50 border border-[#1F2E40] rounded-lg pl-9.5 pr-10 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <KeyRound size={13} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="••••••••••••"
                    className="w-full text-xs font-sans bg-black/50 border border-[#1F2E40] rounded-lg pl-9.5 pr-10 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Modal Actions */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-[#1F2E40] text-zinc-300 text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="submit-password-action-btn"
              className={`flex-1 py-2.5 rounded-lg disabled:opacity-50 text-white text-xs font-bold font-mono transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                isAdminReset
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                  : 'bg-teal-500 hover:bg-teal-400 shadow-teal-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>{isAdminReset ? 'Dispatching Reset...' : 'Re-Keying...'}</span>
              ) : isAdminReset ? (
                <>
                  <Send size={14} /> Send Password Reset
                </>
              ) : (
                <>
                  <KeyRound size={14} /> Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
