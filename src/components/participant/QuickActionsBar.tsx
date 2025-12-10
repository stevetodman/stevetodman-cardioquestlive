/**
 * Quick action buttons for participant voice panel.
 * Provides one-tap access to common commands: Exam, Telemetry, View EKG.
 */

import React from "react";

export interface QuickActionsBarProps {
  sessionId: string;
  showExam: boolean;
  hasTelemetry: boolean;
  hasEkg: boolean;
  showEkg: boolean;
  onRequestExam: () => void;
  onRequestTelemetry: () => void;
  onViewEkg: () => void;
}

export function QuickActionsBar({
  showExam,
  hasTelemetry,
  hasEkg,
  showEkg,
  onRequestExam,
  onRequestTelemetry,
  onViewEkg,
}: QuickActionsBarProps) {
  // Don't render if all actions are unavailable
  if (showExam && hasTelemetry && (!hasEkg || showEkg)) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/60">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2">
        Quick actions
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Request Exam */}
        {!showExam && (
          <button
            type="button"
            onClick={onRequestExam}
            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11 1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exam
          </button>
        )}

        {/* Request Telemetry */}
        {!hasTelemetry && (
          <button
            type="button"
            onClick={onRequestTelemetry}
            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Telemetry
          </button>
        )}

        {/* View EKG (highlighted when available) */}
        {hasEkg && !showEkg && (
          <button
            type="button"
            onClick={onViewEkg}
            className="px-3 py-1.5 rounded-lg border text-amber-200 bg-amber-600/10 border-amber-500/50 hover:border-amber-400 hover:bg-amber-600/20 transition-colors flex items-center gap-1.5 text-xs animate-pulse-slow"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            View EKG
          </button>
        )}
      </div>
    </div>
  );
}
