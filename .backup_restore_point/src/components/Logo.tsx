import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  iconOnly?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtitle?: string;
  showSubtitle?: boolean;
  iconSize?: number;
}

export default function AgentsGuardianLogo({
  size = 'md',
  iconOnly = false,
  className = '',
  iconClassName = '',
  textClassName = '',
  subtitle = 'Sovereign Governance OS',
  showSubtitle = true,
  iconSize,
}: LogoProps) {
  // Dimensions map
  const config = {
    sm: { icon: 28, text: 'text-base', subText: 'text-[8px]' },
    md: { icon: 36, text: 'text-xl', subText: 'text-[9.5px]' },
    lg: { icon: 44, text: 'text-2xl', subText: 'text-[11px]' },
    xl: { icon: 60, text: 'text-3xl', subText: 'text-xs' },
    custom: { icon: iconSize || 36, text: 'text-xl', subText: 'text-[9.5px]' },
  }[size];

  const actualIconSize = iconSize || config.icon;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Clean Vector Shield Emblem Logo */}
      <svg
        viewBox="0 0 30 30"
        className={`shrink-0 ${iconClassName}`}
        style={{ width: actualIconSize, height: actualIconSize }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M15 2L27 8.5V21.5L15 28L3 21.5V8.5Z" fill="#1D9E75" stroke="#0F6E56" strokeWidth="1.2"/>
        <text x="15" y="19.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="white" fontFamily="Inter, sans-serif">G</text>
      </svg>

      {/* Brand Text */}
      {!iconOnly && (
        <div className="truncate">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-extrabold tracking-tight ${config.text} ${textClassName || 'ag-brand-text'}`}>
              Agents<span className="text-[#1D9E75] font-black">Guardian</span>
            </span>
          </div>
          {showSubtitle && subtitle && (
            <span className={`text-zinc-500 font-mono uppercase tracking-widest block font-bold mt-0.5 ${config.subText}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

