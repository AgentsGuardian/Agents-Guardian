/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Skull, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { Toast } from '../types';

interface ToastNotifierProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void; key?: React.Key }) => {
  const duration = toast.duration || 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onRemove]);

  // Determine styling and icon based on type
  let borderClass = 'border-l-4 border-l-sky-500 border-zinc-850';
  let icon = <HelpCircle size={18} className="text-sky-400 shrink-0 mt-0.5 animate-pulse" />;
  let badgeText = 'SYSTEM LOG';
  let badgeBg = 'bg-sky-950/40 text-sky-400 border border-sky-500/10';

  if (toast.type === 'danger') {
    borderClass = 'border-l-4 border-l-red-500 border-zinc-850';
    icon = <Skull size={18} className="text-red-400 shrink-0 mt-0.5 animate-bounce" />;
    badgeText = 'GATEWAY INTERCEPT';
    badgeBg = 'bg-red-950/40 text-red-400 border border-red-500/20';
  } else if (toast.type === 'warning') {
    borderClass = 'border-l-4 border-l-amber-500 border-zinc-850';
    icon = <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />;
    badgeText = 'SLA VIOLATION';
    badgeBg = 'bg-amber-950/40 text-amber-500 border border-amber-500/20';
  } else if (toast.type === 'success') {
    borderClass = 'border-l-4 border-l-emerald-500 border-zinc-850';
    icon = <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />;
    badgeText = 'MITIGATION ACTIVE';
    badgeBg = 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
      className={`relative w-full overflow-hidden bg-[#09090B]/95 border border-zinc-850/80 rounded-lg p-4 shadow-2xl backdrop-blur-lg flex gap-3.5 select-all pointer-events-auto group ${borderClass}`}
      id={`toast-item-${toast.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
              {badgeText}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-650 ml-auto select-none">
            {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <h4 className="font-display font-medium text-white text-xs tracking-tight">
          {toast.title}
        </h4>
        <p className="text-zinc-400 text-[10.5px] font-mono block mt-1 leading-relaxed whitespace-pre-line">
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-zinc-900 cursor-pointer shrink-0 pointer-events-auto select-none"
        aria-label="Dismiss Alert"
        type="button"
      >
        <X size={14} />
      </button>

      {/* SLA Time Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900/40">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`h-full ${
            toast.type === 'danger' 
              ? 'bg-red-500' 
              : toast.type === 'warning' 
                ? 'bg-amber-500' 
                : toast.type === 'success' 
                  ? 'bg-emerald-500' 
                  : 'bg-sky-500'
          }`}
        />
      </div>
    </motion.div>
  );
};

export default function ToastNotifier({ toasts, onRemoveToast }: ToastNotifierProps) {
  // Cap active toast stack to maximum 2 visible toasts
  const visibleToasts = toasts.slice(-2);

  return (
    <div 
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 pointer-events-none flex flex-col-reverse gap-3 max-w-sm w-full px-4 sm:px-0"
      id="toast-global-notifier-container"
    >
      <AnimatePresence mode="popLayout">
        {visibleToasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemoveToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
