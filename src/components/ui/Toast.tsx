/**
 * Toast notification component with variants for different message types.
 */

import React from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  info: "bg-sky-500/15 border-sky-500/50 text-sky-100",
  success: "bg-emerald-500/15 border-emerald-500/50 text-emerald-100",
  warning: "bg-amber-500/15 border-amber-500/50 text-amber-100",
  error: "bg-rose-500/15 border-rose-500/50 text-rose-100",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export function Toast({ message, variant = "info", onDismiss }: ToastProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[12px] shadow-lg shadow-black/20 flex items-center gap-2 animate-slide-down ${variantStyles[variant]}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex-shrink-0">{variantIcons[variant]}</span>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
