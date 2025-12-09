import React from "react";

interface VitalsData {
  hr?: number;
  bp?: string;
  spo2?: number;
  rr?: number;
}

interface CompactVitalsChipProps {
  vitals: VitalsData;
  rhythmSummary?: string;
  onClick?: () => void;
}

/**
 * Compact vitals display for mobile header.
 * Shows key vitals (HR, SpO2) with color coding for abnormal values.
 */
export function CompactVitalsChip({ vitals, rhythmSummary, onClick }: CompactVitalsChipProps) {
  const hr = vitals.hr;
  const spo2 = vitals.spo2;

  // Simple abnormal detection for visual indication
  const hrAbnormal = hr !== undefined && (hr < 60 || hr > 100);
  const spo2Abnormal = spo2 !== undefined && spo2 < 94;
  const hasAbnormal = hrAbnormal || spo2Abnormal;

  if (!hr && !spo2) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
        hasAbnormal
          ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
          : "bg-slate-800/80 border-slate-700 text-slate-200"
      }`}
      aria-label={`Vitals: Heart rate ${hr ?? "—"}, SpO2 ${spo2 ?? "—"}%`}
    >
      {/* Heart rate */}
      {hr !== undefined && (
        <span className={`flex items-center gap-1 ${hrAbnormal ? "text-amber-300" : ""}`}>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span>{hr}</span>
        </span>
      )}

      {/* Divider */}
      {hr !== undefined && spo2 !== undefined && (
        <span className="text-slate-600">|</span>
      )}

      {/* SpO2 */}
      {spo2 !== undefined && (
        <span className={`flex items-center gap-1 ${spo2Abnormal ? "text-amber-300" : ""}`}>
          <span className="text-[10px] text-slate-400">O₂</span>
          <span>{spo2}%</span>
        </span>
      )}

      {/* Expand indicator */}
      <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
