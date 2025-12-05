import React, { useEffect, useMemo, useRef } from "react";

export type TranscriptTurn = {
  id: string;
  role: "patient";
  text: string;
  isComplete: boolean;
};

type VoiceOverlayMode = "idle" | "resident-speaking" | "ai-speaking" | "disabled" | "disconnected";

interface VoicePatientOverlayProps {
  voiceMode: VoiceOverlayMode;
  enabled: boolean;
  floorHolderName?: string | null;
  transcriptTurns: TranscriptTurn[];
  patientAudioUrl?: string;
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
  transcriptTurns,
  patientAudioUrl,
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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (patientAudioUrl && audioRef.current) {
      // best-effort autoplay; browser may block without prior interaction
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // ignore autoplay block; controls remain usable
      });
    }
  }, [patientAudioUrl]);

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

        {patientAudioUrl && (
          <div className="px-4 pb-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1">
              Patient audio
            </div>
            <div className="flex items-center gap-2">
              <audio ref={audioRef} src={patientAudioUrl} controls className="w-full" />
              <button
                type="button"
                onClick={() => audioRef.current?.play().catch(() => {})}
                className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-100 hover:border-slate-600"
              >
                Replay
              </button>
            </div>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-2">
          {transcriptTurns.length === 0 ? (
            <div className="text-xs text-slate-500">No transcript yet.</div>
          ) : (
            transcriptTurns.map((turn) => (
              <div
                key={turn.id}
                className={`text-sm text-slate-100 bg-slate-900/70 border rounded-lg px-3 py-2 ${
                  turn.isComplete ? "border-slate-800" : "border-emerald-600/60"
                }`}
              >
                {turn.text || <span className="text-slate-500 italic">Patient is replying…</span>}
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
