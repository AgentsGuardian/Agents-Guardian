/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Plus, Shield, Activity, Coins, ToggleLeft, ToggleRight, Trash2, CheckCircle2, Search } from 'lucide-react';
import { Policy, PolicyCategory } from '../types';

interface PolicyConfigProps {
  policies: Policy[];
  onTogglePolicy: (id: string) => void;
  onAddPolicy: (newPolicy: Policy) => void;
  onDeletePolicy: (id: string) => void;
}

export default function PolicyConfig({ policies, onTogglePolicy, onAddPolicy, onDeletePolicy }: PolicyConfigProps) {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('POL-SEC-03');
  const [newName, setNewName] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newCat, setNewCat] = useState<PolicyCategory>('security');
  const [newRadius, setNewRadius] = useState<string>('Sandbox Container');
  const [newThreshold, setNewThreshold] = useState<string>('Enforce instantly');
  const [success, setSuccess] = useState<boolean>(false);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all', 'enabled', 'disabled'

  // Counters
  const secCount = policies.filter(p => p.category === 'security').length;
  const ethCount = policies.filter(p => p.category === 'ethics').length;
  const finCount = policies.filter(p => p.category === 'finance').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDesc) return;

    const newObj: Policy = {
      id: newCode,
      code: newCode,
      name: newName,
      description: newDesc,
      category: newCat,
      blastRadius: newRadius,
      threshold: newThreshold,
      enabled: true
    };

    onAddPolicy(newObj);
    
    // Reset form
    setNewName('');
    setNewDesc('');
    setNewCode(`POL-${newCat === 'security' ? 'SEC' : newCat === 'ethics' ? 'ETH' : 'FIN'}-${Math.floor(Math.random() * 90) + 10}`);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
    setShowAddForm(false);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as PolicyCategory;
    setNewCat(cat);
    const prefix = cat === 'security' ? 'SEC' : cat === 'ethics' ? 'ETH' : 'FIN';
    setNewCode(`POL-${prefix}-${Math.floor(Math.random() * 90) + 10}`);
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = 
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.blastRadius.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.threshold.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || policy.category === filterCategory;
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'enabled' && policy.enabled) || 
      (filterStatus === 'disabled' && !policy.enabled);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in text-[#F0EEE6]">
      {/* Intro Header */}
      <div className="p-6 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/35 rounded-xl mt-1">
            <Sliders size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#1D9E75] uppercase tracking-widest bg-[#1D9E75]/10 border border-[#1D9E75]/25 px-2.2 py-0.5 rounded">
                POLICY-AS-CODE CONTROL
              </span>
              <span className="text-xs font-mono text-[#556070] font-bold">Annex IV Core Configuration</span>
            </div>
            <h1 className="text-2xl font-display font-medium text-[#F0EEE6] mt-1.5">
              Automated Policy Enforcement Ledger
            </h1>
            <p className="text-[#8B9BAA] text-sm max-w-xl mt-1">
              Configure parameters, enforce constraints over the active model deployment, or register brand guidelines 
              to alter response models immediately.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-display font-bold text-xs rounded-lg transition shrink-0 shadow-md flex items-center gap-1.5 cursor-pointer"
          id="btn-trigger-add-policy-form"
        >
          <Plus size={14} /> Register New Policy
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2.5 text-xs font-mono font-bold">
          <CheckCircle2 size={16} /> New policy registered successfully! Synced across all active Google AI Studio native gateways.
        </div>
      )}

      {/* Register New Policy Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-6 bg-[#162030] border border-[#1F2E40] rounded-xl space-y-4 animate-slide-up">
          <h3 className="font-display font-bold text-white text-base">Register New Policy-as-Code</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy ID Code</label>
              <input 
                type="text" 
                value={newCode} 
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/30" 
                required
              />
            </div>
            
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy Category</label>
              <select 
                value={newCat} 
                onChange={handleCategoryChange}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-350 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35"
              >
                <option value="security">Security / Kill-Switch</option>
                <option value="ethics">Ethics / Sentiment Audit</option>
                <option value="finance">Finance / Budget Caps</option>
              </select>
            </div>

            <div>
              <label className="text-[#8B9BAA] block mb-1">Target Blast Radius</label>
              <input 
                type="text" 
                value={newRadius} 
                onChange={(e) => setNewRadius(e.target.value)}
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#8B9BAA] block mb-1">Policy Name</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Purge Command Validation Core"
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-205 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
                required
              />
            </div>

            <div>
              <label className="text-[#8B9BAA] block mb-1">Target Threshold Standard</label>
              <input 
                type="text" 
                value={newThreshold} 
                onChange={(e) => setNewThreshold(e.target.value)}
                placeholder="e.g. Halt on budget spike past $25"
                className="w-full bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-205 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
                required
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-[#8B9BAA] block mb-1">Description / Constraint Logic rules</label>
            <textarea 
              value={newDesc} 
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Provide exact rules for the Policy Interceptor to evaluate."
              className="w-full h-20 bg-[#0D1B2A] border border-[#1F2E40] rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/35" 
              required
            />
          </div>

          <div className="flex justify-end gap-3 text-xs font-mono mt-2">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-[#0D1B2A] border border-[#1F2E40] text-[#8B9BAA] hover:text-[#F0EEE6] rounded cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white rounded shadow font-medium cursor-pointer"
              id="btn-register-policy-submit"
            >
              Submit Record to Ledger
            </button>
          </div>
        </form>
      )}

      {/* Category Breakdowns Info panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E24B4A]/10 text-[#E24B4A] rounded-lg">
              <Shield size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Security Policies</span>
              <span className="text-sm font-display font-medium text-white">Active Interceptors</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#E24B4A] bg-[#E24B4A]/10 border border-[#E24B4A]/20 px-2.5 py-0.5 rounded-full">
            {secCount}
          </span>
        </div>

        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1D9E75]/10 text-[#1D9E75] rounded-lg">
              <Activity size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Ethics & Bias Policies</span>
              <span className="text-sm font-display font-medium text-white">Google AI Studio Sentinels</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#1D9E75] bg-[#1D9E75]/10 border border-[#1D9E75]/20 px-2.5 py-0.5 rounded-full">
            {ethCount}
          </span>
        </div>

        <div className="p-4 bg-[#0D1B2A]/90 rounded-lg border border-[#1F2E40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EF9F27]/10 text-[#EF9F27] rounded-lg">
              <Coins size={18} />
            </div>
            <div>
              <span className="text-[#8B9BAA] text-xs font-mono block">Finance Policies</span>
              <span className="text-sm font-display font-medium text-white">Value Budget Limits</span>
            </div>
          </div>
          <span className="text-lg font-mono font-extrabold text-[#EF9F27] bg-[#EF9F27]/10 border border-[#EF9F27]/20 px-2.5 py-0.5 rounded-full">
            {finCount}
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-[#162030] border border-[#1F2E40] flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search policies by code, name, description, blast radius..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
            id="search-policies-input"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer select-none font-bold bg-transparent border-none outline-none"
              id="clear-search-btn"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Category</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-350 font-mono focus:outline-none focus:border-zinc-700"
              id="filter-category-select"
            >
              <option value="all">All</option>
              <option value="security">Security</option>
              <option value="ethics">Ethics</option>
              <option value="finance">Finance</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-zinc-950 border border-zinc-805 rounded p-2 text-xs text-zinc-350 font-mono focus:outline-none focus:border-zinc-700"
              id="filter-status-select"
            >
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {(searchQuery || filterCategory !== 'all' || filterStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterStatus('all');
              }}
              className="px-3 py-2 text-[#E24B4A] hover:bg-red-950/20 border border-zinc-800 hover:border-[#E24B4A]/40 bg-zinc-950 text-xs font-mono tracking-wider font-bold rounded transition cursor-pointer select-none"
              id="reset-policies-filter-btn"
            >
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Policies Grid list */}
      <div className="space-y-4">
        {filteredPolicies.length === 0 ? (
          <div className="p-12 rounded-xl bg-[#162030] border border-[#1F2E40] text-center">
            <Sliders size={32} className="mx-auto text-zinc-500 opacity-40 mb-3 animate-pulse" />
            <h4 className="font-display font-semibold text-zinc-400 text-sm">No Enforced Policies Found</h4>
            <p className="text-zinc-500 text-xs mt-1 max-w-md mx-auto">
              No matching rules matched your current search parameters. Clear query or category bounds to view active ledgers.
            </p>
          </div>
        ) : (
          filteredPolicies.map((policy) => (
          <div 
            key={policy.id} 
            className="p-5 rounded-xl bg-[#162030] border border-[#1F2E40] hover:border-[#1D9E75]/35 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2.5 flex-1 max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10.5px] bg-[#0D1B2A] text-[#8B9BAA] border border-[#1F2E40] font-bold rounded">
                  {policy.code}
                </span>

                <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase border rounded ${
                  policy.category === 'security' 
                    ? 'bg-[#E24B4A]/10 text-[#E24B4A] border-[#E24B4A]/25' 
                    : policy.category === 'ethics' 
                      ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/25' 
                      : 'bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/25'
                }`}>
                  {policy.category}
                </span>

                <span className="text-xs font-mono text-[#556070] font-semibold">
                  Blast: <strong className="text-slate-300">{policy.blastRadius}</strong>
                </span>

                <span className="text-xs font-mono text-[#556070] font-semibold">
                  Threshold: <strong className="text-slate-300">{policy.threshold}</strong>
                </span>
              </div>

              <div>
                <h4 className="font-display font-semibold text-white text-base">
                  {policy.name}
                </h4>
                <p className="text-[#8B9BAA] text-xs mt-1 leading-relaxed">
                  {policy.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <button
                onClick={() => onTogglePolicy(policy.id)}
                className="flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-white transition cursor-pointer"
              >
                {policy.enabled ? (
                  <>
                    <ToggleRight size={26} className="text-[#1D9E75]" />
                    <span className="font-semibold text-[#1D9E75]">ENABLED</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={26} className="text-[#556070]" />
                    <span className="text-[#556070] font-bold">DISABLED</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onDeletePolicy(policy.id)}
                className="p-2 hover:bg-red-500/10 hover:text-[#E24B4A] text-[#556070] border border-transparent rounded transition cursor-pointer"
                title="Delete policy"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
}
