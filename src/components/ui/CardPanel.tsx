/**
 * Reusable card panel component for consistent UI styling.
 * Reduces repeated card/container markup across the codebase.
 */

import React from "react";

export interface CardPanelProps {
  /** Section title displayed at top (optional) */
  title?: string;
  /** Additional subtitle or status text */
  subtitle?: string;
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: "default" | "dark" | "overlay";
  /** Padding size */
  padding?: "none" | "sm" | "md" | "lg";
  /** Additional className for customization */
  className?: string;
  /** Whether to add shadow */
  shadow?: boolean;
}

const VARIANT_CLASSES = {
  default: "bg-slate-900/60 border border-slate-800",
  dark: "bg-slate-950/70 border border-slate-800",
  overlay: "bg-slate-900/80 border border-slate-800",
} as const;

const PADDING_CLASSES = {
  none: "",
  sm: "px-2 py-2",
  md: "px-3 py-3",
  lg: "px-4 py-4",
} as const;

export function CardPanel({
  title,
  subtitle,
  children,
  variant = "default",
  padding = "md",
  className = "",
  shadow = true,
}: CardPanelProps) {
  const baseClasses = [
    VARIANT_CLASSES[variant],
    PADDING_CLASSES[padding],
    "rounded-xl",
    shadow ? "shadow-sm shadow-black/30" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={baseClasses}>
      {(title || subtitle) && (
        <div className="flex items-center justify-between mb-2">
          {title && (
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="text-[10px] text-slate-500">{subtitle}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Compact inline status card for badges and small info.
 */
export interface StatusCardProps {
  children: React.ReactNode;
  className?: string;
}

export function StatusCard({ children, className = "" }: StatusCardProps) {
  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Section header label for grouping content.
 */
export interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <div
      className={`text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold ${className}`}
    >
      {children}
    </div>
  );
}
