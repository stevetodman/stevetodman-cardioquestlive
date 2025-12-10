import React, { useEffect, useMemo, useRef, useState } from "react";
import { ROLE_COLORS } from "../types/voiceGateway";

export type TranscriptTurn = {
  id: string;
  role: "patient";
  character?: string;
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
  compact?: boolean;
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
  compact = false,
}: VoicePatientOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Dev detection - fallback to false if import.meta.env is not available
  const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;

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

  const groupedTurns = useMemo(() => {
    const order = ["patient", "nurse", "tech", "consultant"];
    const map = new Map<string, TranscriptTurn[]>();
    transcriptTurns.forEach((t) => {
      const key = t.character ?? "patient";
      map.set(key, [...(map.get(key) ?? []), t]);
    });
    const ordered = order.filter((k) => map.has(k)).map((k) => ({ key: k, turns: map.get(k)! }));
    const extras = Array.from(map.entries())
      .filter(([k]) => !order.includes(k))
      .map(([key, turns]) => ({ key, turns }));
    return [...ordered, ...extras];
  }, [transcriptTurns]);

  const badgeClass = (character?: string) => {
    const colors = ROLE_COLORS[(character as keyof typeof ROLE_COLORS) || "patient"] ?? ROLE_COLORS.patient;
    return `${colors.text}`;
  };

  return (
    <div className={`absolute top-4 left-4 z-40 ${compact ? "w-[280px]" : "w-[320px]"} max-w-[80vw]`}>
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl shadow-black/40 overflow-hidden">
        {/* Header - always visible, clickable to collapse */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-slate-800 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className={`${compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"} rounded-full bg-sky-600/20 border border-sky-500/50 flex items-center justify-center text-sky-200 font-semibold`}>
              VP
            </div>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Transcript</div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-white`}>
                {transcriptTurns.length > 0 ? `${transcriptTurns.length} turns` : "No turns"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor}`}>
              {modeLabels[voiceMode]}
            </div>
            <span className="text-slate-500 text-sm">{isCollapsed ? "+" : "−"}</span>
          </div>
        </button>

        {/* Collapsible content */}
        {!isCollapsed && (
          <>
            <div className="px-4 py-1.5 text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800/50">
              <div>
                {enabled ? (
                  floorHolderName ? `Floor: ${floorHolderName}` : "Floor open"
                ) : (
                  "Voice disabled"
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClearTranscript(); }}
                className="text-[10px] text-sky-300 hover:text-sky-200"
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
                onClick={() =>
                  audioRef.current?.play().catch((err) => console.error("Failed to replay patient audio", err))
                }
                className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-100 hover:border-slate-600"
              >
                Replay
              </button>
            </div>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-3">
          {transcriptTurns.length === 0 ? (
            <div className="text-xs text-slate-500">No transcript yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groupedTurns.map((group) => (
                <div key={group.key} className="space-y-1">
                  <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${badgeClass(group.key)}`}>
                    {group.key}
                  </div>
                  {group.turns.slice(-4).map((turn) => (
                    <div
                      key={turn.id}
                      className={`text-sm text-slate-100 bg-slate-900/70 border rounded-lg px-3 py-2 space-y-0.5 ${
                        turn.isComplete ? "border-slate-800" : "border-emerald-600/60"
                      }`}
                    >
                      <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${badgeClass(turn.character)}`}>
                        {turn.character ?? "patient"}
                      </div>
                      <div>{turn.text || <span className="text-slate-500 italic">Reply in progress…</span>}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Collapsible legend */}
        <div className="px-4 py-2 flex items-center justify-between text-[10px] text-slate-500">
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className="hover:text-slate-400 transition-colors"
          >
            {showLegend ? "Hide legend" : "Show legend"}
          </button>
          {showLegend && (
            <div className="flex items-center gap-2">
              <span className="text-slate-300">patient</span>
              <span className="text-emerald-300">nurse</span>
              <span className="text-sky-300">tech</span>
              <span className="text-indigo-300">consultant</span>
            </div>
          )}
        </div>

        {/* Dev tools - only in development */}
        {isDev && onAddMockTranscript && (
          <div className="px-4 pb-2 flex items-center justify-between text-[10px] text-slate-600 border-t border-slate-800/50 pt-2">
            <span>DEV</span>
            <button
              type="button"
              onClick={onAddMockTranscript}
              className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-300 text-[9px]"
            >
              + Mock turn
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
