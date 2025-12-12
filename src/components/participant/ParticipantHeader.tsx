/**
 * Participant view header with session code, vitals chip, and connection status.
 */

import React from "react";
import { CompactVitalsChip } from "../CompactVitalsChip";
import { VitalsGrid } from "../ui";

export interface ParticipantHeaderVitals {
  hr?: number;
  bp?: string;
  spo2?: number;
  rr?: number;
}

export interface ParticipantHeaderProps {
  joinCode: string;
  connectionState: "ready" | "connecting" | "disconnected" | "error";
  vitals?: ParticipantHeaderVitals;
  rhythmSummary?: string;
  showVitals: boolean;
  showVitalsPanel: boolean;
  onToggleVitalsPanel: () => void;
  onCloseVitalsPanel: () => void;
  onLeave: () => void;
}

export function ParticipantHeader({
  joinCode,
  connectionState,
  vitals,
  rhythmSummary,
  showVitals,
  showVitalsPanel,
  onToggleVitalsPanel,
  onCloseVitalsPanel,
  onLeave,
}: ParticipantHeaderProps) {
  return (
    <header className="p-3 pt-safe border-b border-slate-900 bg-slate-950 sticky top-0 z-20 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="font-bold text-slate-200 tracking-tight text-sm">CardioQuest</div>
          <div className="text-[11px] font-mono bg-slate-900 px-2 py-0.5 rounded text-sky-400 border border-slate-800">
            {joinCode}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showVitals && vitals && (
            <CompactVitalsChip
              vitals={vitals}
              rhythmSummary={rhythmSummary}
              onClick={onToggleVitalsPanel}
            />
          )}
          <ConnectionBadge state={connectionState} />
          <button
            type="button"
            onClick={onLeave}
            className="text-[11px] px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
      {showVitalsPanel && vitals && (
        <div className="mt-2 bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2 animate-slide-down">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Vitals Monitor</div>
            <button
              type="button"
              onClick={onCloseVitalsPanel}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          </div>
          <VitalsGrid
            hr={vitals.hr}
            bp={vitals.bp}
            spo2={vitals.spo2}
            rr={vitals.rr}
            rhythmSummary={rhythmSummary}
          />
        </div>
      )}
    </header>
  );
}

function ConnectionBadge({ state }: { state: "ready" | "connecting" | "disconnected" | "error" }) {
  const classes =
    state === "ready"
      ? "border-emerald-500/60 text-emerald-200"
      : state === "connecting"
      ? "border-sky-500/60 text-sky-200"
      : "border-slate-700 text-slate-400";

  const label = state === "ready" ? "Live" : state;

  return (
    <div className={`text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full border ${classes}`}>
      {label}
    </div>
  );
}
