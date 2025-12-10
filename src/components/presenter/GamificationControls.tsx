/**
 * Gamification toggle controls for presenter slides mode.
 * Controls visibility of team scores, individual scores, and session summary.
 */

import React from "react";

export interface GamificationControlsProps {
  showSummary: boolean;
  showTeamScores: boolean;
  showIndividualScores: boolean;
  onToggleSummary: () => void;
  onToggleTeamScores: () => void;
  onToggleIndividualScores: () => void;
}

export function GamificationControls({
  showSummary,
  showTeamScores,
  showIndividualScores,
  onToggleSummary,
  onToggleTeamScores,
  onToggleIndividualScores,
}: GamificationControlsProps) {
  return (
    <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm shadow-black/20">
      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
        Gamification
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleSummary}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
            showSummary
              ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-100 shadow-sm shadow-indigo-900/30"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          Session summary
        </button>
        <button
          type="button"
          onClick={onToggleTeamScores}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
            showTeamScores
              ? "bg-sky-600/20 border-sky-500/60 text-sky-100 shadow-sm shadow-sky-900/30"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          Team scores
        </button>
        <button
          type="button"
          onClick={onToggleIndividualScores}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
            showIndividualScores
              ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-100 shadow-sm shadow-emerald-900/30"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          Top players
        </button>
      </div>
    </div>
  );
}
