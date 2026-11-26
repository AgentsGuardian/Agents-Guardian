/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  headerExtra,
  defaultOpen = true,
  children,
  className = "p-6 rounded-xl bg-[#162030] border border-[#1F2E40]",
  id
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className} id={id}>
      <div 
        className={`flex items-center justify-between cursor-pointer select-none ${isOpen ? 'mb-4' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-display font-bold text-white text-base">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-[#8B9BAA] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-2.5 py-1 rounded-lg bg-[#0D1B2A] border border-[#1F2E40] text-[#8B9BAA] hover:text-white hover:bg-[#162030] transition cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            aria-label={isOpen ? "Collapse Section" : "Expand Section"}
          >
            <span className="text-[10px] hidden sm:inline font-sans font-semibold">{isOpen ? "Collapse" : "Expand"}</span>
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
