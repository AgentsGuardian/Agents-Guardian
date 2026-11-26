import React, { useState } from 'react';
import { Bell, Check, Trash2, ShieldAlert, AlertTriangle, CheckCircle2, Info, ArrowRight, Volume2, VolumeX, X } from 'lucide-react';
import { SystemNotification } from '../store/useGovernanceStore';

interface NotificationCenterProps {
  notifications: SystemNotification[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onMarkRead: (id: string) => void;
  disableAlerts: boolean;
  onToggleDisableAlerts: (disabled: boolean) => void;
  onNavigateTab: (tab: string) => void;
}

export default function NotificationCenter({
  notifications,
  onMarkAllRead,
  onClearAll,
  onMarkRead,
  disableAlerts,
  onToggleDisableAlerts,
  onNavigateTab
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filterCategory === 'ALL') return true;
    return n.category.toUpperCase() === filterCategory;
  });

  const formatTimeAgo = (isoString: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return 'just now';
    }
  };

  const getTypeIcon = (type: SystemNotification['type']) => {
    switch (type) {
      case 'danger':
        return <ShieldAlert size={14} className="text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-amber-400 shrink-0" />;
      case 'success':
        return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
      case 'info':
      default:
        return <Info size={14} className="text-blue-400 shrink-0" />;
    }
  };

  const getCategoryBadgeClass = (category: SystemNotification['category']) => {
    switch (category) {
      case 'Security':
        return 'bg-red-500/10 text-red-300 border-red-500/25';
      case 'SLA':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
      case 'Policy':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/25';
      case 'Audit':
        return 'bg-teal-500/10 text-teal-300 border-teal-500/25';
      case 'System':
      default:
        return 'bg-blue-500/10 text-blue-300 border-blue-500/25';
    }
  };

  return (
    <div className="relative shrink-0 z-50">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-black/40 border border-[#1F2E40] hover:border-[--theme-primary]/40 transition-all text-zinc-400 hover:text-white cursor-pointer group"
        title="Notification Center (Quiet-by-Default Feed)"
      >
        <Bell size={16} className={`transition-transform duration-200 ${isOpen ? 'scale-110 text-[--theme-primary]' : 'group-hover:rotate-12'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-amber-500 text-black text-[9px] font-black font-mono rounded-full flex items-center justify-center border border-black shadow animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <>
          {/* Backdrop click outside */}
          <div 
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-[#111E2E] border border-[#1F2E40] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh]">
            
            {/* Drawer Header */}
            <div className="p-3.5 bg-black/40 border-b border-[#1F2E40] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-[--theme-primary]/15 text-[--theme-primary] border border-[--theme-primary]/30">
                  <Bell size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 font-sans flex items-center gap-1.5">
                    System Notification Center
                    {unreadCount > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-bold">
                        {unreadCount} NEW
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Quiet-by-default event ledger
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Mute Toggle Bar */}
            <div className="px-3.5 py-2 bg-zinc-950/60 border-b border-[#1F2E40]/60 flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-400 flex items-center gap-1.5 font-bold">
                {disableAlerts ? <VolumeX size={12} className="text-amber-400" /> : <Volume2 size={12} className="text-emerald-400" />}
                Ambient Toast Popups:
              </span>
              <button
                type="button"
                onClick={() => onToggleDisableAlerts(!disableAlerts)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer border ${
                  disableAlerts 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {disableAlerts ? 'MUTED (QUIET)' : 'ACTIVE'}
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 py-2 border-b border-[#1F2E40]/50 bg-[#0D1B2A]/40 flex items-center gap-1 overflow-x-auto text-[10px] font-mono no-scrollbar">
              {['ALL', 'SECURITY', 'SLA', 'POLICY', 'SYSTEM'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer shrink-0 ${
                    filterCategory === cat
                      ? 'bg-[--theme-primary] text-black shadow'
                      : 'text-zinc-400 hover:text-slate-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Notification List Body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-[#1F2E40]/30 min-h-[160px]">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500/50" />
                  <p className="text-xs text-zinc-400 font-mono">No notifications in filter category.</p>
                  <p className="text-[10px] text-zinc-600">All gateway interceptors operating nominally.</p>
                </div>
              ) : (
                filteredNotifications.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onMarkRead(item.id)}
                    className={`p-2.5 rounded-lg transition-all cursor-pointer text-left space-y-1 group relative ${
                      !item.read 
                        ? 'bg-black/40 border border-[#1F2E40] hover:border-[--theme-primary]/40' 
                        : 'bg-transparent hover:bg-black/20 opacity-75'
                    }`}
                  >
                    {!item.read && (
                      <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getTypeIcon(item.type)}
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold uppercase tracking-wider ${getCategoryBadgeClass(item.category)}`}>
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-[--theme-primary] transition-colors leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans line-clamp-2">
                      {item.message}
                    </p>

                    {item.targetTab && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(item.id);
                          onNavigateTab(item.targetTab!);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[--theme-primary] hover:underline pt-0.5 font-bold cursor-pointer"
                      >
                        Module Jump <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer Quick Actions */}
            <div className="p-2.5 bg-black/60 border-t border-[#1F2E40] flex items-center justify-between text-[10px] font-mono">
              <button
                type="button"
                onClick={onMarkAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 text-zinc-400 hover:text-teal-300 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors cursor-pointer"
              >
                <Check size={12} /> Mark all read
              </button>

              <button
                type="button"
                onClick={onClearAll}
                disabled={notifications.length === 0}
                className="flex items-center gap-1 text-zinc-400 hover:text-red-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors cursor-pointer"
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
