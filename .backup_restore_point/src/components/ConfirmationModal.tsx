/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Check } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  typeToConfirm?: string; // e.g. "BYPASS" or "DELETE"
  badgeText?: string;
  severity?: 'danger' | 'warning' | 'info';
  detailsList?: string[];
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  typeToConfirm,
  badgeText = 'CONFIRMATION REQUIRED',
  severity = 'danger',
  detailsList
}: ConfirmationModalProps) {
  const [typedValue, setTypedValue] = useState('');

  if (!isOpen) return null;

  const requiresMatch = Boolean(typeToConfirm);
  const isMatch = !requiresMatch || typedValue.trim().toUpperCase() === typeToConfirm?.toUpperCase();

  const handleConfirm = () => {
    if (!isMatch) return;
    onConfirm();
    setTypedValue('');
    onClose();
  };

  const severityColors = {
    danger: {
      border: 'border-red-500/40',
      bg: 'bg-red-950/20',
      badgeBg: 'bg-red-950/50 text-red-400 border-red-500/30',
      icon: <ShieldAlert className="text-red-400 h-6 w-6 shrink-0" />,
      btn: 'bg-red-600 hover:bg-red-500 text-white'
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-950/20',
      badgeBg: 'bg-amber-950/50 text-amber-400 border-amber-500/30',
      icon: <AlertTriangle className="text-amber-400 h-6 w-6 shrink-0" />,
      btn: 'bg-amber-600 hover:bg-amber-500 text-white'
    },
    info: {
      border: 'border-blue-500/40',
      bg: 'bg-blue-950/20',
      badgeBg: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
      icon: <AlertTriangle className="text-blue-400 h-6 w-6 shrink-0" />,
      btn: 'bg-blue-600 hover:bg-blue-500 text-white'
    }
  };

  const style = severityColors[severity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`relative w-full max-w-md rounded-xl bg-[#111E2E] border ${style.border} p-6 shadow-2xl space-y-4`}>
        {/* Header bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${style.badgeBg}`}>
              {style.icon}
            </div>
            <div>
              <span className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${style.badgeBg}`}>
                {badgeText}
              </span>
              <h3 className="text-base font-display font-bold text-white mt-1">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition p-1 rounded hover:bg-zinc-800 cursor-pointer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description text */}
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
          {description}
        </p>

        {/* Optional details bullet list */}
        {detailsList && detailsList.length > 0 && (
          <div className="p-3 bg-black/40 rounded-lg border border-[#1F2E40] text-xs font-mono text-zinc-300 space-y-1">
            {detailsList.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[#1D9E75] font-bold">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Type to Confirm Input */}
        {requiresMatch && (
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-mono text-zinc-400 block font-semibold">
              Type <strong className="text-red-400 font-black">{typeToConfirm}</strong> below to confirm:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={`Type "${typeToConfirm}"`}
              className="w-full bg-black/60 border border-[#1F2E40] focus:border-red-500 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1F2E40]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0D1B2A] border border-[#1F2E40] text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={requiresMatch && !isMatch}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${style.btn} ${requiresMatch && !isMatch ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Check size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
