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
  loadingExam?: boolean;
  loadingTelemetry?: boolean;
  onRequestExam: () => void;
  onRequestTelemetry: () => void;
  onViewEkg: () => void;
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function QuickActionsBar({
  showExam,
  hasTelemetry,
  hasEkg,
  showEkg,
  loadingExam = false,
  loadingTelemetry = false,
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
            disabled={loadingExam}
            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px] justify-center"
          >
            {loadingExam ? (
              <Spinner />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11 1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {loadingExam ? "Ordering..." : "Exam"}
          </button>
        )}

        {/* Request Telemetry */}
        {!hasTelemetry && (
          <button
            type="button"
            onClick={onRequestTelemetry}
            disabled={loadingTelemetry}
            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px] justify-center"
          >
            {loadingTelemetry ? (
              <Spinner />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {loadingTelemetry ? "Ordering..." : "Telemetry"}
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
