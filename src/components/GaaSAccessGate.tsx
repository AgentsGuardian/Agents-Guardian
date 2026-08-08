/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, User, Mail, Briefcase, Landmark, CheckCircle2, Server, Star, HelpCircle, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { AdminUser, AdminRole } from '../types';
import AgentsGuardianLogo from './Logo';

interface GaaSAccessGateProps {
  users: AdminUser[];
  onLoginSuccess: (user: AdminUser) => void;
  onRegisterUser: (newUser: AdminUser) => void;
  addToast: (t: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number }) => void;
}

const PRESET_GOOGLE_ACCOUNTS = [
  { name: 'Mritunjoy Singh', email: 'mritunjoysingh@gmail.com', avatar: 'M', subtitle: 'Google Workspace Owner' },
  { name: 'Sarah Jenkins', email: 's.jenkins@enterprise-tech.io', avatar: 'S', subtitle: 'VP Security Engineering, Enterprise Tech' },
  { name: 'David Chen', email: 'd.chen@cloud-dynamics.com', avatar: 'D', subtitle: 'Cloud Infrastructure Lead, Dynamics' },
  { name: 'Elena Rostova', email: 'elena.r@fintech-global.eu', avatar: 'E', subtitle: 'Chief Risk Officer, FinTech Global' },
  { name: 'Alex Rivera', email: 'a.rivera@guardian.tech', avatar: 'A', subtitle: 'Principal Security Architect' },
];

export default function GaaSAccessGate({
  users,
  onLoginSuccess,
  onRegisterUser,
  addToast,
}: GaaSAccessGateProps) {
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Google SSO Simulation States
  const [showGoogleSsoModal, setShowGoogleSsoModal] = useState<boolean>(false);
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState<boolean>(false);
  const [googleSsoEmail, setGoogleSsoEmail] = useState<string>('');
  const [googleSsoName, setGoogleSsoName] = useState<string>('');
  const [googleSsoRole, setGoogleSsoRole] = useState<AdminRole>('Admin');
  const [googleSsoErrors, setGoogleSsoErrors] = useState<{ email?: string; name?: string }>({});

  // Password Reset Simulation States
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetStep, setResetStep] = useState<'request' | 'otp' | 'newpass'>('request');
  const [resetOtpCode, setResetOtpCode] = useState<string>('');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [resetNewPassword, setResetNewPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [resetError, setResetError] = useState<string>('');
  const [resetTokenState, setResetTokenState] = useState<string>('');
  const [showSimulatedEmailNotification, setShowSimulatedEmailNotification] = useState<boolean>(false);

  const isGoogleAccount = (emailAddress: string) => {
    const normalized = emailAddress.toLowerCase().trim();
    const found = users.find(u => u.email.toLowerCase().trim() === normalized);
    return found?.lastLogin === 'Google SSO Registered' || found?.lastLogin.includes('Google SSO');
  };

  // Form Fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AdminRole>('Admin');
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isLoginView) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });

        const data = await res.json();
        if (!res.ok) {
          addToast({
            type: 'danger',
            title: '❌ Authentication Failed',
            message: data.error || 'Invalid credentials or account suspended.'
          });
          return;
        }

        if (data.token) {
          localStorage.setItem('ag_session_token', data.token);
        }

        onLoginSuccess(data.user);
        addToast({
          type: 'success',
          title: '🛡️ Identity Verified: Gateway Open',
          message: `Welcome back, Admin Operator ${data.user.name}. Session token issued under role: ${data.user.role}.`
        });
      } catch (err: any) {
        addToast({
          type: 'danger',
          title: '🔑 Authentication Network Error',
          message: 'Unable to reach authentication gateway endpoint.'
        });
      }
    } else {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            role: selectedRole,
            organization: orgName.trim()
          })
        });

        const data = await res.json();
        if (!res.ok) {
          addToast({
            type: 'danger',
            title: '⚠️ Registration Failed',
            message: data.error || 'Unable to register account.'
          });
          return;
        }

        if (data.token) {
          localStorage.setItem('ag_session_token', data.token);
        }

        onRegisterUser(data.user);
        addToast({
          type: 'success',
          title: '🛡️ License Authorization Active',
          message: `Registered successfully! Authenticating session...`
        });

        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 300);
      } catch (err) {
        addToast({
          type: 'danger',
          title: 'Network Error',
          message: 'Failed to connect to registration backend service.'
        });
      }
    }
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
            <AgentsGuardianLogo size="lg" subtitle="Sovereign Governance OS" />

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

          {isLoginView ? (
            <div className="mb-5 animate-in fade-in duration-200" id="google-id-federated-bypass-container">
              <button
                type="button"
                onClick={() => {
                  const targetEmail = email.trim().toLowerCase();
                  if (targetEmail) {
                    const matchedUser = users.find(u => u.email.toLowerCase().trim() === targetEmail);
                    if (matchedUser) {
                      onLoginSuccess(matchedUser);
                      addToast({
                        type: 'success',
                        title: '🛡️ Google ID Verified',
                        message: `Secure federated login authorized for ${matchedUser.name} (${matchedUser.email}).`
                      });
                      return;
                    }
                  }
                  // Open interactive Google SSO registration modal to cleanly capture visitor identity
                  if (targetEmail) {
                    setGoogleSsoEmail(targetEmail);
                    setShowCustomGoogleInput(true);
                  } else {
                    setShowCustomGoogleInput(false);
                  }
                  setShowGoogleSsoModal(true);
                  addToast({
                    type: 'info',
                    title: '📝 Customer & Visitor Federation',
                    message: `Please select your Google Account or complete federated registration.`
                  });
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
          ) : (
            <div className="mb-5 animate-in fade-in duration-200" id="google-id-federated-register-container">
              <button
                type="button"
                onClick={() => {
                  if (email.trim()) {
                    setGoogleSsoEmail(email.trim());
                    if (name.trim()) setGoogleSsoName(name.trim());
                    setShowCustomGoogleInput(true);
                  } else {
                    setShowCustomGoogleInput(false);
                  }
                  setShowGoogleSsoModal(true);
                  addToast({
                    type: 'info',
                    title: '🔐 Google Identity Federation',
                    message: 'Select your Google Account and choose your desired customer role.'
                  });
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-zinc-900/60 hover:bg-zinc-900/100 border border-[#1F2E40] hover:border-teal-500/50 text-slate-100 font-display font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-sm"
                id="google-id-register-btn"
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
                Register with Google Account
              </button>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#1F2E40]/30"></div>
                <span className="flex-shrink mx-3 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">or register with custom details</span>
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
                    if (!isOwner && selectedRole === 'SuperAdmin') {
                      setSelectedRole('Admin');
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
              <div className="flex justify-between items-center select-none">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                  Administrative Codecard Password
                </label>
                {isLoginView && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetStep('request');
                      setResetError('');
                      setShowResetModal(true);
                      setShowSimulatedEmailNotification(false);
                    }}
                    className="text-[10px] text-teal-400 hover:text-teal-300 hover:underline transition-all cursor-pointer font-mono font-bold"
                    id="trigger-forgot-password-btn"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
                      {email.toLowerCase().trim() === 'mritunjoysingh@gmail.com' && (
                        <option value="SuperAdmin" className="bg-[#0C121D] text-amber-400 font-bold">💎 SuperAdmin (Master Workspace Owner)</option>
                      )}
                      <option value="Admin" className="bg-[#0C121D] text-slate-300">Admin (Tenant Instance Administrator)</option>
                      <option value="PolicyManager" className="bg-[#0C121D] text-slate-300">PolicyManager</option>
                      <option value="Auditor" className="bg-[#0C121D] text-slate-300">Auditor (View-Only Logs)</option>
                      <option value="Operator" className="bg-[#0C121D] text-slate-300">Operator (Standard)</option>
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
                {isLoginView ? 'Sign In' : 'Create Account'}
              </button>
            </div>

          </form>

          {/* Secure Warning Label Footer */}
          <div className="mt-6 pt-5 border-t border-[#1F2E40]/40 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5 leading-none">
              <span className="h-2 w-2 rounded-full bg-teal-500/30 block animate-pulse"></span>
              SECURE TLS ENCRYPTED CONNECTION
            </span>
            <span className="text-[11px] text-zinc-500">
              GaaS-SYS-AUTH_v4.1
            </span>
          </div>

        </div>

      </div>

      {showGoogleSsoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0F1626] border border-[#1F2E40] rounded-xl shadow-2xl p-6 relative overflow-hidden" id="google-sso-modal">
            {/* Ambient subtle light */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-[#1F2E40]/60 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <h3 className="font-display font-bold text-white text-sm">Google Federated Registration</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleSsoModal(false);
                  setGoogleSsoEmail('');
                  setGoogleSsoName('');
                  setGoogleSsoErrors({});
                }}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mb-4 leading-normal font-sans">
              Choose your existing Google account to continue to Agents Guardian Tenant Portal.
            </p>

            <div className="space-y-4">
              {!showCustomGoogleInput ? (
                <div className="space-y-3">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Select Google Profile
                  </label>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {PRESET_GOOGLE_ACCOUNTS.map((acc, idx) => {
                      const isSelected = googleSsoEmail.toLowerCase().trim() === acc.email.toLowerCase().trim();
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setGoogleSsoEmail(acc.email);
                            setGoogleSsoName(acc.name);
                            if (googleSsoErrors.email) setGoogleSsoErrors(prev => ({ ...prev, email: '' }));
                            if (googleSsoErrors.name) setGoogleSsoErrors(prev => ({ ...prev, name: '' }));
                          }}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-teal-500/15 border-teal-500 text-white shadow-md shadow-teal-500/10'
                              : 'bg-black/40 border-[#1F2E40] hover:bg-zinc-900/80 hover:border-zinc-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-xs flex-shrink-0 ${
                              isSelected ? 'bg-teal-500 text-white' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                            }`}>
                              {acc.avatar}
                            </div>
                            <div className="min-w-0">
                              <div className="font-display font-bold text-xs truncate flex items-center gap-1.5">
                                {acc.name}
                                {isSelected && <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">Selected</span>}
                              </div>
                              <div className="font-mono text-[10px] text-zinc-400 truncate">{acc.email}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-teal-400 flex-shrink-0 ml-2 animate-in zoom-in duration-150" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomGoogleInput(true);
                      setGoogleSsoEmail('');
                      setGoogleSsoName('');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-[#1F2E40] hover:border-teal-500/40 text-slate-300 font-mono text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>➕ Use another Google account...</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                      Custom Google Account
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomGoogleInput(false);
                        setGoogleSsoEmail(PRESET_GOOGLE_ACCOUNTS[0].email);
                        setGoogleSsoName(PRESET_GOOGLE_ACCOUNTS[0].name);
                      }}
                      className="text-[10px] text-teal-400 hover:text-teal-300 font-mono underline cursor-pointer"
                    >
                      ⬅ Back to account picker
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                      Google Account Email
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <Mail size={13} />
                      </span>
                      <input
                        type="email"
                        value={googleSsoEmail}
                        onChange={(e) => {
                          setGoogleSsoEmail(e.target.value);
                          if (googleSsoErrors.email) setGoogleSsoErrors(prev => ({ ...prev, email: '' }));
                        }}
                        placeholder="e.g. operator.account@gmail.com"
                        className={`w-full text-xs font-sans bg-black/40 border rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all ${
                          googleSsoErrors.email ? 'border-red-500/60' : 'border-[#1F2E40]'
                        }`}
                      />
                    </div>
                    {googleSsoErrors.email && (
                      <p className="text-[10px] text-red-400 font-mono mt-1">{googleSsoErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                      Full Account Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                        <User size={13} />
                      </span>
                      <input
                        type="text"
                        value={googleSsoName}
                        onChange={(e) => {
                          setGoogleSsoName(e.target.value);
                          if (googleSsoErrors.name) setGoogleSsoErrors(prev => ({ ...prev, name: '' }));
                        }}
                        placeholder="e.g. Jane Doe"
                        className={`w-full text-xs font-sans bg-black/40 border rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all ${
                          googleSsoErrors.name ? 'border-red-500/60' : 'border-[#1F2E40]'
                        }`}
                      />
                    </div>
                    {googleSsoErrors.name && (
                      <p className="text-[10px] text-red-400 font-mono mt-1">{googleSsoErrors.name}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-1 border-t border-[#1F2E40]/40">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                  Assigned IAM Role Privilege (Customer Instance)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Briefcase size={13} />
                  </span>
                  <select
                    value={googleSsoRole}
                    onChange={(e) => setGoogleSsoRole(e.target.value as AdminRole)}
                    className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-3 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all cursor-pointer"
                  >
                    {googleSsoEmail.toLowerCase().trim() === 'mritunjoysingh@gmail.com' && (
                      <option value="SuperAdmin" className="bg-[#0C121D] text-amber-400 font-bold">💎 SuperAdmin (Master Workspace Owner)</option>
                    )}
                    <option value="Admin" className="bg-[#0C121D] text-slate-300">👑 Admin (Tenant Instance Administrator)</option>
                    <option value="PolicyManager" className="bg-[#0C121D] text-slate-300">👔 PolicyManager</option>
                    <option value="Auditor" className="bg-[#0C121D] text-slate-300">🔍 Auditor (View-Only Logs)</option>
                    <option value="Operator" className="bg-[#0C121D] text-slate-300">⚙️ Operator (Standard)</option>
                  </select>
                </div>
                <p className="text-[9.5px] text-zinc-500 leading-tight mt-1 font-sans">
                  {googleSsoEmail.toLowerCase().trim() === 'mritunjoysingh@gmail.com'
                    ? 'Note: Root Super Admin privileges are unlocked and tied strictly to your master owner email.'
                    : 'Note: Super Admin rights are strictly tied to the Master Workspace Owner email address (mritunjoysingh@gmail.com).'}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowGoogleSsoModal(false);
                    setGoogleSsoEmail('');
                    setGoogleSsoName('');
                    setGoogleSsoErrors({});
                  }}
                  className="flex-1 py-2 rounded-lg bg-zinc-900 border border-[#1F2E40] hover:bg-zinc-800 text-zinc-350 text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const errors: { email?: string; name?: string } = {};
                    if (!googleSsoEmail.trim()) {
                      errors.email = 'Please select or enter a Google email account.';
                    } else if (!googleSsoEmail.includes('@')) {
                      errors.email = 'Please enter a valid Google email address.';
                    }
                    if (!googleSsoName.trim()) {
                      errors.name = 'Full account name is required.';
                    }

                    if (Object.keys(errors).length > 0) {
                      setGoogleSsoErrors(errors);
                      return;
                    }

                    const sanitizedEmail = googleSsoEmail.toLowerCase().trim();
                    const existingUser = users.find(u => u.email.toLowerCase().trim() === sanitizedEmail);
                    if (existingUser) {
                      addToast({
                        type: 'warning',
                        title: '⚠️ Profile Already Registered',
                        message: `A system operator with Google ID "${sanitizedEmail}" already exists. Logging in seamlessly.`
                      });
                      setShowGoogleSsoModal(false);
                      onLoginSuccess(existingUser);
                      return;
                    }

                    if (googleSsoRole === 'SuperAdmin' && sanitizedEmail !== 'mritunjoysingh@gmail.com') {
                      addToast({
                        type: 'danger',
                        title: '🔒 Access Denied: SuperAdmin Restrained',
                        message: 'Super Admin rights are strictly tied to the Master Workspace Owner email address (mritunjoysingh@gmail.com).'
                      });
                      return;
                    }

                    // Register new Google SSO user with their selected role
                    const userRegId = `USR-REQ-${Math.floor(100 + Math.random() * 900)}`;
                    const newAdminRecord: AdminUser = {
                      id: userRegId,
                      name: googleSsoName.trim(),
                      email: sanitizedEmail,
                      role: googleSsoRole,
                      status: 'ACTIVE',
                      mfaEnabled: true,
                      lastLogin: 'Google SSO Registered'
                    };
                    onRegisterUser(newAdminRecord);
                    
                    addToast({
                      type: 'success',
                      title: '💎 Google SSO Registered',
                      message: `Successfully registered and authenticated ${googleSsoName.trim()} with [${googleSsoRole}] privilege via Google SSO.`
                    });

                    setShowGoogleSsoModal(false);
                    setTimeout(() => {
                      onLoginSuccess(newAdminRecord);
                    }, 500);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold font-display transition-all cursor-pointer shadow-lg shadow-teal-500/15 flex items-center justify-center gap-1.5"
                >
                  <span>Continue with Google</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0F1626] border border-[#1F2E40] rounded-xl shadow-2xl p-6 relative overflow-hidden" id="reset-password-modal">
            {/* Ambient subtle light */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-[#1F2E40]/60 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-400" />
                <h3 className="font-display font-bold text-white text-sm">GaaS Credentials Recovery</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetEmail('');
                  setResetError('');
                  setShowSimulatedEmailNotification(false);
                }}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-lg text-[11px] mb-4 font-sans flex items-start gap-2">
                <span className="mt-0.5 font-bold">⚠️</span>
                <span>{resetError}</span>
              </div>
            )}

            {resetStep === 'request' && (
              <div className="space-y-4">
                <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                  Enter your registered corporate or licensing email below. Standard accounts will receive an encrypted verification codecard key to reset password. Google SSO authenticated accounts must continue via Google ID.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Mail size={13} />
                    </span>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetError) setResetError('');
                      }}
                      placeholder="name@guardian.gov"
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetEmail('');
                      setResetError('');
                    }}
                    className="flex-1 py-2 rounded-lg bg-zinc-900 border border-[#1F2E40] hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const emailVal = resetEmail.trim().toLowerCase();
                      if (!emailVal) {
                        setResetError('Please enter your license email address.');
                        return;
                      }
                      if (!emailVal.includes('@')) {
                        setResetError('Please enter a valid email address format.');
                        return;
                      }

                      try {
                        const res = await fetch('/api/auth/forgot-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: emailVal })
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setResetError(data.error || 'Password reset request failed.');
                          return;
                        }

                        if (data.resetToken) {
                          setResetTokenState(data.resetToken);
                        }

                        addToast({
                          type: 'info',
                          title: '📧 Reset Token Issued',
                          message: data.message || `Password reset token generated for ${emailVal}.`
                        });

                        setResetStep('newpass');
                      } catch (err) {
                        setResetError('Failed to connect to password reset service.');
                      }
                    }}
                    className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Send Password Reset Link
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'otp' && (
              <div className="space-y-4">
                <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                  We have dispatched a cryptographic reset key to your workspace email. Enter the key precisely to unlock credential override.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Reset Verification Key
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Lock size={13} />
                    </span>
                    <input
                      type="text"
                      value={resetOtpCode}
                      onChange={(e) => {
                        setResetOtpCode(e.target.value);
                        if (resetError) setResetError('');
                      }}
                      placeholder="GUARDIAN-XXXXXX"
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('request');
                      setResetOtpCode('');
                      setResetError('');
                      setShowSimulatedEmailNotification(false);
                    }}
                    className="flex-1 py-2 rounded-lg bg-zinc-900 border border-[#1F2E40] hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (resetOtpCode.trim().toUpperCase() !== generatedOtp) {
                        setResetError('Invalid security reset key. Please verify the code on your simulated email and try again.');
                        return;
                      }

                      setResetStep('newpass');
                      setResetError('');
                    }}
                    className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Verify Key
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'newpass' && (
              <div className="space-y-4">
                <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                  Identity authenticated successfully. Please establish a new, strong codecard password to secure your operator session.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    New Codecard Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Lock size={13} />
                    </span>
                    <input
                      type="password"
                      value={resetNewPassword}
                      onChange={(e) => {
                        setResetNewPassword(e.target.value);
                        if (resetError) setResetError('');
                      }}
                      placeholder="••••••••"
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Lock size={13} />
                    </span>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => {
                        setResetConfirmPassword(e.target.value);
                        if (resetError) setResetError('');
                      }}
                      placeholder="••••••••"
                      className="w-full text-xs font-sans bg-black/40 border border-[#1F2E40] rounded-lg pl-9.5 pr-4 py-2.5 text-slate-100 placeholder:text-zinc-650 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetEmail('');
                      setResetError('');
                      setResetOtpCode('');
                      setResetNewPassword('');
                      setResetConfirmPassword('');
                      setShowSimulatedEmailNotification(false);
                    }}
                    className="flex-1 py-2 rounded-lg bg-zinc-900 border border-[#1F2E40] hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!resetNewPassword) {
                        setResetError('New password is required.');
                        return;
                      }
                      if (resetNewPassword.length < 5) {
                        setResetError('Password must contain at least 5 characters.');
                        return;
                      }
                      if (resetNewPassword !== resetConfirmPassword) {
                        setResetError('Passwords do not match.');
                        return;
                      }

                      try {
                        const res = await fetch('/api/auth/reset-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            token: resetTokenState,
                            newPassword: resetNewPassword
                          })
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setResetError(data.error || 'Failed to update password.');
                          return;
                        }

                        addToast({
                          type: 'success',
                          title: '🔒 Password Updated',
                          message: `Successfully updated password for ${resetEmail}. You may now sign in.`
                        });

                        setPassword(resetNewPassword);
                        setEmail(resetEmail);
                        setIsLoginView(true);

                        setShowResetModal(false);
                        setResetEmail('');
                        setResetError('');
                        setResetOtpCode('');
                        setResetNewPassword('');
                        setResetConfirmPassword('');
                        setResetTokenState('');
                        setShowSimulatedEmailNotification(false);
                      } catch (err) {
                        setResetError('Network error resetting password.');
                      }
                    }}
                    className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Confirm New Credentials
                  </button>
                </div>
              </div>
            )}

            {/* Simulated Email Delivery Inbox Overlay */}
            {showSimulatedEmailNotification && (
              <div className="mt-5 pt-4 border-t border-[#1F2E40]/60 animate-in slide-in-from-bottom duration-300">
                <div className="bg-[#090D16] border border-teal-500/30 rounded-lg p-3.5 relative overflow-hidden font-mono">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-teal-500/20 text-teal-400 text-[8px] rounded-bl border-l border-b border-teal-500/20 tracking-wider uppercase font-bold animate-pulse">
                    Simulated Mail Server
                  </div>
                  <div className="text-[10px] text-zinc-500 space-y-0.5 border-b border-[#1F2E40]/40 pb-2 mb-2">
                    <div><span className="text-zinc-400 font-bold">From:</span> secure-no-reply@agentsguardian.gov</div>
                    <div><span className="text-zinc-400 font-bold">To:</span> {resetEmail}</div>
                    <div><span className="text-zinc-400 font-bold">Subject:</span> [SECURE-OTP] GaaS Codecard Overrides</div>
                  </div>
                  <div className="text-[11px] text-slate-300 leading-normal">
                    <p>A credentials override request has been registered for your administrative workspace license.</p>
                    <p className="mt-2 text-zinc-400 text-[10px]">Use the following cryptographic verification key to complete authorization:</p>
                    <div className="my-2.5 p-2 bg-black/60 rounded border border-[#1F2E40] text-center text-teal-400 font-bold text-xs select-all cursor-pointer hover:border-teal-500/50 transition-all flex items-center justify-center gap-1.5" title="Copy verification key">
                      <span>{generatedOtp}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-snug">Note: If you did not initiate this request, immediately alert your team's designated Security Auditor.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
