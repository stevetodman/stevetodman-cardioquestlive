import React, { useMemo } from "react";

type VoiceOverlayMode = "idle" | "resident-speaking" | "ai-speaking" | "disabled" | "disconnected";

interface VoicePatientOverlayProps {
  voiceMode: VoiceOverlayMode;
  enabled: boolean;
  floorHolderName?: string | null;
  transcriptLines: string[];
  onClearTranscript: () => void;
  onAddMockTranscript?: () => void;
}

const modeLabels: Record<VoiceOverlayMode, string> = {
  idle: "Idle",
  "resident-speaking": "Resident speaking",
  "ai-speaking": "AI responding",
  disabled: "Disabled",
  disconnected: "Disconnected",
};

export function VoicePatientOverlay({
  voiceMode,
  enabled,
  floorHolderName,
  transcriptLines,
  onClearTranscript,
  onAddMockTranscript,
}: VoicePatientOverlayProps) {
  const statusColor = useMemo(() => {
    switch (voiceMode) {
      case "ai-speaking":
        return "bg-emerald-600/20 text-emerald-200 border-emerald-500/60";
      case "resident-speaking":
        return "bg-sky-600/20 text-sky-100 border-sky-500/60";
      case "disabled":
      case "disconnected":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-900 text-slate-200 border-slate-700";
    }
  }, [voiceMode]);

  return (
    <div className="absolute top-4 left-4 z-40 w-[320px] max-w-[80vw]">
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-600/20 border border-sky-500/50 flex items-center justify-center text-sky-200 font-semibold text-sm">
              VP
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Virtual Patient</div>
              <div className="text-sm font-semibold text-white">Interactive</div>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusColor}`}>
            {modeLabels[voiceMode]}
          </div>
        </div>

        <div className="px-4 py-2 text-xs text-slate-400 flex items-center justify-between">
          <div>
            {enabled ? (
              floorHolderName ? `Floor: ${floorHolderName}` : "Floor open"
            ) : (
              "Voice disabled"
            )}
          </div>
          <button
            type="button"
            onClick={onClearTranscript}
            className="text-[11px] text-sky-300 hover:text-sky-200 underline decoration-dotted"
          >
            Clear
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-2">
          {transcriptLines.length === 0 ? (
            <div className="text-xs text-slate-500">No transcript yet.</div>
          ) : (
            transcriptLines.map((line, idx) => (
              <div
                key={`${idx}-${line.slice(0, 10)}`}
                className="text-sm text-slate-100 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2"
              >
                {line}
              </div>
            ))
          )}
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>DEV: Transcript helper</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddMockTranscript}
                className="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-200"
              >
                Add line
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
