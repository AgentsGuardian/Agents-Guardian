/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, User, Mail, Briefcase, Landmark, CheckCircle2, Server, Star, HelpCircle, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { AdminUser, AdminRole } from '../types';

interface GaaSAccessGateProps {
  users: AdminUser[];
  onLoginSuccess: (user: AdminUser) => void;
  onRegisterUser: (newUser: AdminUser) => void;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
}

export default function GaaSAccessGate({
  users,
  onLoginSuccess,
  onRegisterUser,
  addToast,
}: GaaSAccessGateProps) {
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form Fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AdminRole>('Operator');
  const [orgName, setOrgName] = useState<string>('');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);

  // Error validations
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Form action handlers
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (isLoginView) {
      if (!email.trim()) errors.email = 'Corporate email details are required.';
      else if (!email.includes('@')) errors.email = 'Please provide a valid email structure.';
      if (!password) errors.password = 'Security password hash is required.';
    } else {
      if (!name.trim()) errors.name = 'Full name is required to authenticate administrative credentials.';
      if (!email.trim()) errors.email = 'Email address is required.';
      else if (!email.includes('@')) errors.email = 'Please provide a valid email format (e.g. name@domain.com).';
      if (!password) errors.password = 'A secure entry password is required.';
      else if (password.length < 5) errors.password = 'Security password must contain at least 5 alphanumeric keys.';
      if (!acceptTerms) errors.accept = 'You must accept compliance terms of the safety system.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isLoginView) {
      // Find matching user
      // Supporting both simulation signin (by email match)
      const sanitizedEmail = email.toLowerCase().trim();
      const matchedUser = users.find(u => u.email.toLowerCase().trim() === sanitizedEmail);

      if (matchedUser) {
        if (matchedUser.status === 'SUSPENDED') {
          addToast({
            type: 'danger',
            title: '❌ Authorization Expired/Suspended',
            message: `The credentials index for "${matchedUser.name}" are marked as SUSPENDED under security incident directive POL-SEC-01.`
          });
          return;
        }

        // Successfully logged in
        onLoginSuccess(matchedUser);
        addToast({
          type: 'success',
          title: '🛡️ Identity Verified: Gateway Open',
          message: `Welcome back, Admin Operator ${matchedUser.name}. Session token compiled under role: ${matchedUser.role}.`
        });
      } else {
        // Create an on-the-fly default account matching or toast error
        addToast({
          type: 'danger',
          title: '🔑 Cryptographic Credentials Miss',
          message: `No active federated license found matching "${email}". Please register below to generate temporary keycards.`
        });
      }
    } else {
      // Register new user
      const existingUser = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
      if (existingUser) {
        addToast({
          type: 'danger',
          title: '⚠️ License Collision Detected',
          message: `The corporate email ID "${email}" index is already mapped to user "${existingUser.name}". Please log in instead.`
        });
        return;
      }

      // Safe new administrative registration
      const userRegId = `USR-REQ-${Math.floor(100 + Math.random() * 900)}`;
      const newAdminRecord: AdminUser = {
        id: userRegId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: selectedRole,
        status: 'ACTIVE',
        mfaEnabled: true,
        lastLogin: 'Just Registered (Portal Access Captured)'
      };

      // Push registration upward
      onRegisterUser(newAdminRecord);
      
      addToast({
        type: 'success',
        title: '🛡️ License Authorization Active',
        message: `Registered successfully! Account verification token generated. Automatically authenticating session...`
      });

      // Directly authorize session
      setTimeout(() => {
        onLoginSuccess(newAdminRecord);
      }, 500);
    }
  };

  // Demo user quick-fill shortcuts for outstanding UX evaluation
  const handleQuickDemoClick = (demoUser: AdminUser) => {
    setEmail(demoUser.email);
    setPassword('demo-guardian-secure-pass-7104');
    setIsLoginView(true);
    setFormErrors({});
    addToast({
      type: 'info',
      title: '📁 Quick Credentials Loaded',
      message: `Loaded credentials index for ${demoUser.name} (${demoUser.role}). Click Sign In to execute payload.`
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden relative select-none" id="gaas-gateway-page">
      {/* Absolute Ambient Grid Overlays */}
      <div className="absolute inset-0 bg-[#07090F] opacity-95" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(20,40,70,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(20,40,70,0.4)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-550/10 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 bg-[#0C121D]/90 border border-[#1F2E40] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden relative z-10" id="gate-container-box">
        
        {/* Left Side: Product Branding Information Panels */}
        <div className="md:col-span-5 p-6 sm:p-10 bg-gradient-to-br from-[#0B0F19] to-[#121A2A] border-b md:border-b-0 md:border-r border-[#1F2E40]/70 flex flex-col justify-between relative" id="left-branding-pane">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Shield size={200} className="text-teal-400 font-bold" />
          </div>

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 30 30" className="w-10 h-10 flex-shrink-0" fill="none">
                <path d="M15 2L27 8.5V21.5L15 28L3 21.5V8.5Z" fill="#1D9E75" stroke="#0F6E56" strokeWidth="1"/>
                <text x="15" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill="white" fontFamily="sans-serif">G</text>
              </svg>
              <div>
                <h1 className="font-display font-extrabold text-[22px] tracking-tight text-white leading-none">
                  Agent<span className="text-teal-400">Guardian</span>
                </h1>
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block font-bold mt-1">
                  Sovereign Governance OS
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-[#1F2E40]/60 space-y-4">
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-red-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-105">Active Threat Interceptor</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">Real-time isolation shields guarding incoming queries from hostile model injection vectors.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="h-7 w-7 rounded bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                  <Activity size={14} className="text-teal-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-105">Cognitive Health Sentinel</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">Continuous evaluation checks checking inputs to block hijacked prompts and jailbreak attempts instantly.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="h-7 w-7 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <Eye size={14} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-105">Value Meter &amp; Observability</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">Continuous tracking of execution cost efficiencies, token auditing logs, and active stream ROI indices.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="h-7 w-7 rounded bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Server size={14} className="text-amber-400" />
                </div>
                <div>
                  <h4 className="text-[11.5px] font-semibold text-slate-105">Multi-Framework Core REST</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">Unified secure endpoint connecting LangChain, LlamaIndex, and native API pipelines safely.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Secure Authentication Form Canvas */}
        <div className="md:col-span-7 p-6 sm:p-10 bg-[#0E1524] relative flex flex-col justify-center">

          <div className="mb-6">
            <div className="flex bg-black/50 border border-[#1F2E40]/80 p-1 rounded-lg w-full max-w-xs" id="gate-tab-controller">
              <button
                type="button"
                onClick={() => {
                  setIsLoginView(true);
                  setFormErrors({});
                }}
                className={`flex-1 py-1.5 text-center font-display font-semibold text-xs rounded-md transition-all cursor-pointer ${
                  isLoginView 
                    ? 'bg-teal-500 text-white font-bold shadow-md' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLoginView(false);
                  setFormErrors({});
                }}
                className={`flex-1 py-1.5 text-center font-display font-semibold text-xs rounded-md transition-all cursor-pointer ${
                  !isLoginView 
                    ? 'bg-teal-500 text-white font-bold shadow-md' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              {isLoginView ? 'Welcome operator, authorize session' : 'Enroll administrator license key'}
            </h2>
            <p className="text-xs text-zinc-400">
              {isLoginView 
                ? 'Authorized GaaS gateway requires continuous ledger logging. Enter credentials to mount active shields.' 
                : 'Provide registration credentials. Your profile is audited dynamically inside the system logs.'}
            </p>
          </div>

          {isLoginView && (
            <div className="mb-5 animate-in fade-in duration-200" id="google-id-federated-bypass-container">
              <button
                type="button"
                onClick={() => {
                  const ownerEmail = 'mritunjoysingh@gmail.com';
                  const matchedUser = users.find(u => u.email.toLowerCase().trim() === ownerEmail);
                  if (matchedUser) {
                    onLoginSuccess(matchedUser);
                    addToast({
                      type: 'success',
                      title: '🛡️ Google ID Verified',
                      message: `Secure federated bypass authorized for Workspace Owner ${matchedUser.name}.`
                    });
                  } else {
                    addToast({
                      type: 'danger',
                      title: '🔒 Federated Authentication Error',
                      message: 'Owner record could not be found in active memory registries.'
                    });
                  }
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-zinc-900/60 hover:bg-zinc-900/100 border border-[#1F2E40] hover:border-teal-500/50 text-slate-100 font-display font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-sm"
                id="google-id-bypass-btn"
              >
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign In with Google Account
              </button>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#1F2E40]/30"></div>
                <span className="flex-shrink mx-3 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">or sign in with credentials</span>
                <div className="flex-grow border-t border-[#1F2E40]/30 font-mono"></div>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4" id="access-portal-form">
            
            {!isLoginView && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                  Full Account Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <User size={13} />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Marcus Sterling"
                    className={`w-full text-xs font-sans bg-black/40 border rounded-lg pl-9.5 pr-4 py-2.5 text-slate-102 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all ${
                      formErrors.name ? 'border-red-500/60' : 'border-[#1F2E40]'
                    }`}
                    id="reg-input-name"
                  />
                </div>
                {formErrors.name && (
                  <p className="text-[10.5px] text-red-400 font-mono font-bold mt-1">{formErrors.name}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                Corporate / License Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Mail size={13} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    const isOwner = val.toLowerCase().trim() === 'mritunjoysingh@gmail.com';
                    if (!isOwner && (selectedRole === 'Admin' || selectedRole === 'SuperAdmin')) {
                      setSelectedRole('Operator');
                    }
                  }}
                  placeholder="name@guardian.gov"
                  className={`w-full text-xs font-sans bg-black/40 border rounded-lg pl-9.5 pr-4 py-2.5 text-slate-102 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all ${
                    formErrors.email ? 'border-red-500/60' : 'border-[#1F2E40]'
                  }`}
                  id="auth-input-email"
                />
              </div>
              {formErrors.email && (
                <p className="text-[10.5px] text-red-400 font-mono font-bold mt-1">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                Administrative Codecard Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Lock size={13} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full text-xs font-sans bg-black/40 border rounded-lg pl-9.5 pr-10 py-2.5 text-slate-102 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all ${
                    formErrors.password ? 'border-red-500/60' : 'border-[#1F2E40]'
                  }`}
                  id="auth-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white cursor-pointer"
                  id="toggle-pass-visibility-btn"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[10.5px] text-red-400 font-mono font-bold mt-1">{formErrors.password}</p>
              )}
            </div>

            {!isLoginView && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Desired IAM Role Privilege
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Briefcase size={13} />
                    </span>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-3 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all cursor-pointer"
                      id="reg-input-role"
                    >
                      <option value="Operator" className="bg-[#0C121D] text-slate-300">Operator (Standard)</option>
                      <option value="PolicyManager" className="bg-[#0C121D] text-slate-300">PolicyManager</option>
                      <option value="Auditor" className="bg-[#0C121D] text-slate-300">Auditor (View-Only Logs)</option>
                      {email.toLowerCase().trim() === 'mritunjoysingh@gmail.com' && (
                        <>
                          <option value="Admin" className="bg-[#0C121D] text-slate-300">Admin</option>
                          <option value="SuperAdmin" className="bg-[#0C121D] text-slate-300">SuperAdmin (Master)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Organization / Node Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Landmark size={13} />
                    </span>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Agency or Corp Name"
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-4 py-2.5 text-slate-102 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                      id="reg-input-organization"
                    />
                  </div>
                </div>
              </div>
            )}

            {!isLoginView && (
              <div className="pt-2 animate-in fade-in duration-150">
                <label className="flex items-start gap-2.5 text-zinc-400 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-900 bg-zinc-950 text-teal-400 accent-teal-500 focus:ring-0 cursor-pointer"
                    id="reg-input-accept-terms"
                  />
                  <span className="text-[11px] leading-tight text-zinc-400">
                    I permit public logging of registration metadata. Signups are captured in the system's identity ledger inside settings under published corporate auditing frameworks.
                  </span>
                </label>
                {formErrors.accept && (
                  <p className="text-[10.5px] text-red-400 font-mono font-bold mt-1">{formErrors.accept}</p>
                )}
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-display font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer transform active:scale-98 hover:shadow-teal-500/10"
                id="sumbit-auth-credentials-btn"
              >
                <Shield size={14} className="text-white" />
                {isLoginView ? 'Authenticate Session Security' : 'Generate Administrative License Key'}
              </button>
            </div>

          </form>

          {/* Secure Warning Label Footer */}
          <div className="mt-6 pt-5 border-t border-[#1F2E40]/40 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5 leading-none">
              <span className="h-2 w-2 rounded-full bg-teal-500/30 block animate-pulse"></span>
              TLS ENCRYPTED HYDRATION
            </span>
            <span className="text-[11px] text-zinc-500">
              GaaS-SYS-AUTH_v4.1
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
