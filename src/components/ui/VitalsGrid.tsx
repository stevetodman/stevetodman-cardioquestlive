/**
 * Simple vitals grid display for expanded panel views.
 * Shows HR, BP, SpO2, RR in a 4-column layout.
 */

import React from "react";

export interface VitalsGridProps {
  hr?: number;
  bp?: string;
  spo2?: number;
  rr?: number;
  rhythmSummary?: string;
  /** Optional className for wrapper */
  className?: string;
}

export function VitalsGrid({ hr, bp, spo2, rr, rhythmSummary, className = "" }: VitalsGridProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <VitalCell value={hr} label="HR" />
        <VitalCell value={bp} label="BP" />
        <VitalCell value={spo2} label="SpO₂" suffix="%" />
        <VitalCell value={rr} label="RR" />
      </div>
      {rhythmSummary && (
        <div className="text-xs text-slate-300 border-t border-slate-800 pt-2 mt-2">
          <span className="text-slate-500">Rhythm:</span> {rhythmSummary}
        </div>
      )}
    </div>
  );
}

interface VitalCellProps {
  value?: number | string;
  label: string;
  suffix?: string;
}

function VitalCell({ value, label, suffix = "" }: VitalCellProps) {
  return (
    <div>
      <div className="text-lg font-bold text-slate-100">
        {value ?? "—"}{value !== undefined && suffix}
      </div>
      <div className="text-[9px] text-slate-500 uppercase">{label}</div>
    </div>
  );
}
