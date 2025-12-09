import React from "react";
import { VoiceConnectionStatus, VoiceConnectionState, CharacterId, ROLE_COLORS } from "../types/voiceGateway";

interface SimulationStatusBarProps {
  /** WebSocket connection status */
  connectionStatus: VoiceConnectionStatus | VoiceConnectionState;
  /** Whether voice is enabled for the session */
  voiceEnabled: boolean;
  /** Current floor holder (who's speaking) */
  floorHolderName?: string | null;
  /** Last spoken character */
  lastCharacter?: CharacterId;
  /** Recent transcript preview */
  lastTranscript?: string;
  /** Budget info */
  budget?: {
    fallback: boolean;
    throttled: boolean;
    usdEstimate?: number;
  };
  /** Callback to toggle voice enabled */
  onToggleVoice?: () => void;
}

const statusConfig: Record<VoiceConnectionState, { label: string; color: string; pulse: boolean }> = {
  disconnected: { label: "Disconnected", color: "bg-slate-700 text-slate-400", pulse: false },
  connecting: { label: "Connecting...", color: "bg-amber-600/20 text-amber-200", pulse: true },
  ready: { label: "Ready", color: "bg-emerald-600/20 text-emerald-200", pulse: false },
  error: { label: "Error", color: "bg-rose-600/20 text-rose-200", pulse: false },
};

/**
 * Shows the autonomous simulation status.
 * The sim runs on its own - students interact via their phones.
 * Presenter can watch but doesn't need to intervene.
 */
export function SimulationStatusBar({
  connectionStatus,
  voiceEnabled,
  floorHolderName,
  lastCharacter,
  lastTranscript,
  budget,
  onToggleVoice,
}: SimulationStatusBarProps) {
  // Handle both object (VoiceConnectionStatus) and string (VoiceConnectionState) forms
  const stateValue = typeof connectionStatus === "string" ? connectionStatus : connectionStatus.state;
  const status = statusConfig[stateValue] || statusConfig.disconnected;
  const isActive = stateValue === "ready" && voiceEnabled;

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`relative w-3 h-3 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-600"}`}>
          {status.pulse && (
            <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
          )}
          {isActive && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse opacity-50" />
          )}
        </div>
        <span className={`text-sm font-medium ${isActive ? "text-emerald-200" : "text-slate-400"}`}>
          {isActive ? "Simulation Active" : status.label}
        </span>
      </div>

      {/* Current speaker */}
      {isActive && (
        <div className="flex items-center gap-2 text-xs">
          {floorHolderName ? (
            <>
              <span className="text-slate-500">Speaking:</span>
              <span className="text-sky-300 font-medium">{floorHolderName}</span>
            </>
          ) : (
            <span className="text-slate-500">Floor open</span>
          )}
        </div>
      )}

      {/* Last character response */}
      {isActive && lastCharacter && lastTranscript && (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
              ROLE_COLORS[lastCharacter]?.bg || "bg-slate-800"
            } ${ROLE_COLORS[lastCharacter]?.text || "text-slate-300"}`}
          >
            {lastCharacter}
          </span>
          <span className="text-xs text-slate-400 truncate">
            {lastTranscript.slice(0, 60)}{lastTranscript.length > 60 ? "..." : ""}
          </span>
        </div>
      )}

      {/* Budget indicator */}
      {budget && (
        <div
          className={`px-2 py-1 rounded text-[10px] font-semibold ${
            budget.fallback
              ? "bg-rose-600/20 text-rose-200 border border-rose-500/50"
              : budget.throttled
              ? "bg-amber-600/20 text-amber-200 border border-amber-500/50"
              : "bg-emerald-600/15 text-emerald-200 border border-emerald-500/40"
          }`}
        >
          {budget.fallback ? "Text only" : budget.throttled ? "Throttled" : "Voice OK"}
          {typeof budget.usdEstimate === "number" && (
            <span className="ml-1 text-slate-400">${budget.usdEstimate.toFixed(2)}</span>
          )}
        </div>
      )}

      {/* Voice toggle */}
      {onToggleVoice && (
        <button
          type="button"
          onClick={onToggleVoice}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            voiceEnabled
              ? "bg-emerald-600/20 border border-emerald-500/60 text-emerald-100 hover:bg-emerald-600/30"
              : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          {voiceEnabled ? "Voice On" : "Voice Off"}
        </button>
      )}

      {/* Info hint */}
      <div className="hidden lg:block text-[10px] text-slate-500 max-w-[180px]">
        Students interact via their phones. The AI responds automatically.
      </div>
    </div>
  );
}
