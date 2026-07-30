/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Radio, Activity, Coins, Sliders, Menu, X, Landmark, Cpu, Settings, Users, Fingerprint, HelpCircle, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { AdminUser, Toast } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  policiesCount: number;
  haltedCount: number;
  currentUser: AdminUser;
  setCurrentUser: (user: AdminUser) => void;
  users: AdminUser[];
  addToast: (t: Omit<Toast, 'id' | 'timestamp'>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  policiesCount, 
  haltedCount,
  currentUser,
  setCurrentUser,
  users,
  addToast,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const menuItems = [
    { id: 'overview', name: '⬡ Overview', icon: Landmark, description: 'Unified Governance Lifecycle' },
    { id: 'secure', name: '⏻ Kill-Switch', icon: Shield, description: 'Active Threat Interceptor', badge: haltedCount > 0 ? `${haltedCount} HALTED` : undefined, badgeStyle: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { id: 'observe', name: '◎ Observability', icon: Activity, description: 'Cognitive Health Sentinel', badge: 'AI Studio Native', badgeStyle: 'bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30' },
    { id: 'measure', name: '▦ Value Meter', icon: Coins, description: 'Economic Process & ROI', badge: 'ERP Cost Sync', badgeStyle: 'bg-[#EF9F27]/12 text-[#EF9F27] border-[#EF9F27]/30' },
    { id: 'gaas', name: '⬢ GaaS / APIs', icon: Cpu, description: 'Multi-Framework Core REST', badge: 'REST Webhook', badgeStyle: 'bg-teal-500/15 text-teal-450 border-teal-500/20' },
    { id: 'policies', name: 'Policy Engine', icon: Sliders, description: 'Configure Blast Radii', badge: `${policiesCount} Rules`, badgeStyle: 'bg-zinc-800/50 text-zinc-400 border-zinc-800' },
    { id: 'admin', name: '⚙ Setting & IAM', icon: Settings, description: 'Enterprise Access Control', badge: 'Admin Shield', badgeStyle: 'bg-indigo-550/15 text-indigo-400 border-indigo-500/20' },
    { id: 'onboarding', name: '🚀 Customer Onboarding', icon: Rocket, description: '5-Step Integration & SDKs', badge: 'SDK & Proxy', badgeStyle: 'bg-teal-500/15 text-teal-300 border-teal-500/25' },
    { id: 'help', name: '❖ User Guide & Help', icon: HelpCircle, description: 'Docs, Video & AI Copilot', badge: 'Docs & Help', badgeStyle: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  ];

  return (
    <>
      {/* Mobile Header with 3-bar toggle on the left for ideal mobile layout UX */}
      <div className="lg:hidden flex items-center gap-2.5 px-4 py-3 bg-black border-b border-zinc-800 text-slate-100 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -ml-1 rounded-md hover:bg-zinc-900 text-[#8B9BAA] shrink-0"
          id="mobile-menu-toggle"
          aria-label="Toggle Navigation Menu"
        >
          {isOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <svg viewBox="0 0 30 30" className="w-8 h-8 flex-shrink-0" fill="none">
            <path d="M15 2L27 8.5V21.5L15 28L3 21.5V8.5Z" fill="#1D9E75" stroke="#0F6E56" strokeWidth="1"/>
            <text x="15" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill="white" fontFamily="sans-serif">G</text>
          </svg>
          <div className="truncate">
            <span className="font-display font-bold tracking-tight text-[#F0EEE6] block text-sm sm:text-base leading-tight">Agents<span className="text-[#1D9E75]">Guardian</span></span>
            <span className="text-[8px] sm:text-[9px] text-[#1D9E75] font-mono uppercase tracking-widest block font-bold truncate">GOVERNANCE CORE OS</span>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-black border-r border-zinc-800 text-[#8B9BAA] 
        flex flex-col transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0
        ${isCollapsed ? 'lg:w-20' : 'lg:w-80'} w-72
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Logo */}
        <div className={`p-4 md:p-5 border-b border-zinc-800 bg-zinc-950 flex ${isCollapsed ? 'flex-col gap-4' : 'flex-row'} items-center justify-between`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3.5 min-w-0'}`}>
            <svg viewBox="0 0 30 30" className="w-10 h-10 flex-shrink-0" fill="none">
              <path d="M15 2L27 8.5V21.5L15 28L3 21.5V8.5Z" fill="#1D9E75" stroke="#0F6E56" strokeWidth="1"/>
              <text x="15" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill="white" fontFamily="sans-serif">G</text>
            </svg>
            {!isCollapsed && (
              <div className="truncate animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-extrabold text-[20px] tracking-tight text-white leading-none">Agents<span className="text-teal-400">Guardian</span></span>
                  <span className="text-[9px] bg-teal-500/10 text-teal-450 border border-teal-500/20 px-1 py-0.2 rounded font-mono uppercase">GaaS</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block font-bold mt-1">
                  Sovereign Governance OS
                </span>
              </div>
            )}
          </div>
          
          <button 
            type="button"
            onClick={onToggleCollapse}
            className={`${isCollapsed ? 'mx-auto' : 'ml-2'} hidden lg:flex p-1.5 rounded-lg bg-zinc-900/55 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            id="sidebar-toggle-trigger"
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Unified Status Bar */}
        {!isCollapsed ? (
          <div className="mx-4 mt-5 p-3.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
              </span>
              <span className="text-xs font-mono text-teal-400 tracking-wider font-bold">GAAS NOMINAL</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 text-right bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              SYSTEM_OK
            </div>
          </div>
        ) : (
          <div className="my-5 flex justify-center" title="GAAS NOMINAL - SYSTEM OK">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-400"></span>
            </span>
          </div>
        )}

        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-mono font-bold uppercase text-zinc-650 tracking-widest animate-in fade-in duration-200">
              Lifecycle & Gateway Pillars
            </div>
          )}

          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                title={`${item.name.replace(/[^\w\s-&]/g, '').trim()}${item.badge ? ` (${item.badge})` : ''}`}
                className={`
                  w-full flex items-center ${isCollapsed ? 'justify-center px-1 py-3' : 'items-start gap-3.5 px-3.5 py-3'} rounded-lg text-left transition-all duration-200 group
                  ${isSelected 
                    ? 'bg-teal-550/10 border border-teal-500/25 text-teal-400 shadow-[inset_0_1px_3px_rgba(20,180,140,0.1)]' 
                    : 'hover:bg-zinc-900/45 text-zinc-400 hover:text-white border border-transparent'
                  }
                `}
              >
                <div className={`
                  p-1.5 rounded-md transition-colors shrink-0
                  ${isSelected ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-zinc-950 group-hover:bg-zinc-900 text-zinc-500 group-hover:text-white border border-zinc-900'}
                `}>
                  <IconComponent size={18} />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display font-semibold text-sm tracking-wide text-inherit">
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${item.badgeStyle || 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-600 group-hover:text-zinc-400 block mt-0.5 leading-snug truncate">
                      {item.description}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer system status information */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 text-[11px] text-zinc-600 font-mono">
          {!isCollapsed ? (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1">
                <span>ANNEX IV PORT STATUS</span>
                <span className="text-teal-400 font-bold">READY</span>
              </div>
              <div className="flex items-center justify-between">
                <span>PLATFORM SHIELD</span>
                <span>GAAS-v4.9.112</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-[10px] text-teal-400 font-bold" title="GAAS-v4.9.112 Platform Shield Ready">
              v4.9
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
