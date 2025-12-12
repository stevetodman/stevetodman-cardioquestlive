import React, { useState, useEffect, useRef, useMemo } from "react";
import { VoiceState, VoiceCommandType } from "../types";
import { VoiceConnectionStatus, CharacterId, ROLE_COLORS, PatientScenarioId } from "../types/voiceGateway";
import { setVoiceEnabled } from "../hooks/useVoiceState";
import { sendVoiceCommand } from "../services/voiceCommands";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import { TranscriptLogTurn } from "./SessionTranscriptPanel";

/** Complex scenarios that have their own phase progression - don't show manual override controls */
const COMPLEX_SCENARIO_IDS = ["teen_svt_complex_v1", "peds_myocarditis_silent_crash_v1"];

interface AutonomousSimPanelProps {
  sessionId: string;
  voice: VoiceState;
  connectionStatus: VoiceConnectionStatus;
  /** Live transcript from the simulation */
  transcriptLog: TranscriptLogTurn[];
  /** Current simulation state */
  simState?: {
    stageId?: string;
    vitals?: Record<string, unknown>;
    budget?: {
      fallback: boolean;
      throttled: boolean;
      usdEstimate?: number;
    };
  };
  /** Current scenario */
  scenarioId: PatientScenarioId;
  scenarioOptions: { id: PatientScenarioId; label: string }[];
  onScenarioChange: (id: PatientScenarioId) => void;
}

async function emitCommand(
  sessionId: string,
  type: VoiceCommandType,
  payload?: Record<string, unknown>,
  character?: CharacterId
) {
  sendVoiceCommand(sessionId, { type, payload, character }).catch((err) => {
    console.error("Failed to write voice command to Firestore", err);
  });
  try {
    voiceGatewayClient.sendVoiceCommand(type, payload, character);
  } catch (err) {
    console.error("Failed to send WS voice command", err);
  }
}

/**
 * Simplified panel for autonomous simulation mode.
 * The sim runs on its own - students interact via their phones.
 * Presenter monitors and can intervene when needed.
 */
export function AutonomousSimPanel({
  sessionId,
  voice,
  connectionStatus,
  transcriptLog,
  simState,
  scenarioId,
  scenarioOptions,
  onScenarioChange,
}: AutonomousSimPanelProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus.state === "ready" || connectionStatus.state === "connecting";
  const isActive = connectionStatus.state === "ready" && voice.enabled;
  const isComplexScenario = COMPLEX_SCENARIO_IDS.includes(scenarioId);

  // Stop any playing audio
  const handleStopAudio = () => {
    // Stop all audio elements on the page
    document.querySelectorAll("audio").forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    setFeedbackMsg("Audio stopped");
  };

  // Get base timestamp for relative time display
  const baseTimestamp = useMemo(
    () => (transcriptLog.length > 0 ? transcriptLog[0].timestamp : Date.now()),
    [transcriptLog]
  );

  const formatTime = (timestamp: number) => {
    const diffSeconds = Math.max(0, Math.round((timestamp - baseTimestamp) / 1000));
    const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, "0");
    const seconds = (diffSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLog]);

  // Clear feedback message after delay
  useEffect(() => {
    if (feedbackMsg) {
      const t = setTimeout(() => setFeedbackMsg(null), 2000);
      return () => clearTimeout(t);
    }
  }, [feedbackMsg]);

  const handleToggleVoice = async () => {
    await setVoiceEnabled(sessionId, !voice.enabled);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      emitCommand(sessionId, "resume_ai");
      setIsPaused(false);
      setFeedbackMsg("Resumed simulation");
    } else {
      emitCommand(sessionId, "pause_ai");
      setIsPaused(true);
      setFeedbackMsg("Paused simulation");
    }
  };

  return (
    <div className="flex flex-col gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 shadow-sm shadow-black/30">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className={`relative w-3 h-3 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-600"}`}>
              {isActive && !isPaused && (
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse opacity-50" />
              )}
            </div>
            <span className={`text-sm font-medium ${isActive ? "text-emerald-200" : "text-slate-400"}`}>
              {!voice.enabled
                ? "Voice Disabled"
                : connectionStatus.state === "connecting"
                ? "Connecting..."
                : connectionStatus.state === "error"
                ? "Connection Error"
                : isPaused
                ? "Paused"
                : "Simulation Active"}
            </span>
          </div>

          {/* Budget indicator */}
          {simState?.budget && (
            <span
              className={`px-2 py-1 rounded text-[10px] font-semibold ${
                simState.budget.fallback
                  ? "bg-rose-600/20 text-rose-200 border border-rose-500/50"
                  : simState.budget.throttled
                  ? "bg-amber-600/20 text-amber-200 border border-amber-500/50"
                  : "bg-emerald-600/15 text-emerald-200 border border-emerald-500/40"
              }`}
            >
              {simState.budget.fallback ? "Text only" : simState.budget.throttled ? "Throttled" : "Voice OK"}
              {typeof simState.budget.usdEstimate === "number" && (
                <span className="ml-1 text-slate-400">${simState.budget.usdEstimate.toFixed(2)}</span>
              )}
            </span>
          )}

          {/* Current vitals summary */}
          {isActive && simState?.vitals && (
            <span className="text-[11px] text-slate-400">
              HR {(simState.vitals as any).hr ?? "—"} · SpO₂ {(simState.vitals as any).spo2 ?? "—"}%
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Scenario selector - only when not active */}
          {!isActive && (
            <select
              value={scenarioId}
              onChange={(e) => onScenarioChange(e.target.value as PatientScenarioId)}
              className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100"
            >
              {scenarioOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Enable/Disable voice */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              voice.enabled
                ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-100 hover:bg-emerald-600/30"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {voice.enabled ? "Voice On" : "Voice Off"}
          </button>

          {/* Pause/Resume - only when active */}
          {isActive && (
            <button
              type="button"
              onClick={handlePauseResume}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isPaused
                  ? "bg-amber-600/20 border-amber-500/60 text-amber-100 hover:bg-amber-600/30"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
              }`}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}

          {/* Stop Audio button - always available */}
          <button
            type="button"
            onClick={handleStopAudio}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-rose-600/20 border-rose-500/60 text-rose-100 hover:bg-rose-600/30"
          >
            Stop Audio
          </button>
        </div>
      </div>

      {/* Feedback message */}
      {feedbackMsg && (
        <div className="text-xs text-emerald-300 bg-emerald-600/10 border border-emerald-500/30 rounded px-2 py-1">
          {feedbackMsg}
        </div>
      )}

      {/* Info message */}
      <div className="text-xs text-slate-500">
        {isComplexScenario
          ? "Complex scenario with automatic phase progression. Use Stop Audio if needed."
          : "Students interact via their phones. The AI responds automatically."}
      </div>

      {/* Live transcript */}
      {isActive && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Live Conversation
          </div>
          <div className="max-h-[200px] overflow-y-auto bg-slate-950/50 rounded-lg border border-slate-800 p-3 space-y-2">
            {transcriptLog.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                Waiting for student interaction...
              </div>
            ) : (
              transcriptLog.slice(-15).map((entry) => {
                const speaker = entry.character || (entry.role === "doctor" ? "student" : entry.role);
                const isStudent = entry.role === "doctor";
                return (
                  <div key={entry.id} className="flex items-start gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0 w-10 text-right">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                        isStudent
                          ? "bg-sky-600/20 text-sky-200"
                          : ROLE_COLORS[speaker as CharacterId]?.bg || "bg-slate-800"
                      } ${
                        isStudent
                          ? ""
                          : ROLE_COLORS[speaker as CharacterId]?.text || "text-slate-300"
                      }`}
                    >
                      {isStudent ? "Student" : speaker}
                    </span>
                    <span className="text-sm text-slate-200">{entry.text}</span>
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* Stage indicator when active */}
      {isActive && simState?.stageId && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500">Stage:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
            {simState.stageId}
          </span>
        </div>
      )}
    </div>
  );
}
