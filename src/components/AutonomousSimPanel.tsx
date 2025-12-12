import React, { useState, useEffect, useRef, useMemo } from "react";
import { VoiceState, VoiceCommandType } from "../types";
import { VoiceConnectionStatus, CharacterId, ROLE_COLORS, PatientScenarioId } from "../types/voiceGateway";
import { setVoiceEnabled } from "../hooks/useVoiceState";
import { sendVoiceCommand } from "../services/voiceCommands";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import { TranscriptLogTurn } from "./SessionTranscriptPanel";

/** Scenario events the presenter can trigger */
type ScenarioEvent = {
  id: string;
  label: string;
  description: string;
  category: "vitals" | "rhythm" | "clinical";
  payload: Record<string, unknown>;
};

const SCENARIO_EVENTS: ScenarioEvent[] = [
  // Vitals changes
  { id: "hypoxia", label: "Hypoxia", description: "SpO2 drops to 80%", category: "vitals", payload: { event: "hypoxia", spo2: 80 } },
  { id: "tachycardia", label: "Tachycardia", description: "HR increases to 180", category: "vitals", payload: { event: "tachycardia", hr: 180 } },
  { id: "hypotension", label: "Hypotension", description: "BP drops to 70/40", category: "vitals", payload: { event: "hypotension", bp: "70/40" } },
  { id: "fever", label: "Fever", description: "Temp spikes to 39.5°C", category: "vitals", payload: { event: "fever", temp: 39.5 } },
  { id: "stabilize", label: "Stabilize", description: "Return vitals to normal", category: "vitals", payload: { event: "stabilize" } },
  // Rhythm changes
  { id: "vtach", label: "V-Tach", description: "Ventricular tachycardia", category: "rhythm", payload: { event: "rhythm_change", rhythm: "vtach" } },
  { id: "svt", label: "SVT", description: "Supraventricular tachycardia", category: "rhythm", payload: { event: "rhythm_change", rhythm: "svt" } },
  { id: "afib", label: "A-Fib", description: "Atrial fibrillation", category: "rhythm", payload: { event: "rhythm_change", rhythm: "afib" } },
  { id: "sinus", label: "Sinus", description: "Return to sinus rhythm", category: "rhythm", payload: { event: "rhythm_change", rhythm: "sinus" } },
  // Clinical events
  { id: "deteriorate", label: "Deteriorate", description: "Patient worsens", category: "clinical", payload: { event: "deteriorate" } },
  { id: "improve", label: "Improve", description: "Patient improves", category: "clinical", payload: { event: "improve" } },
  { id: "code", label: "Code Blue", description: "Cardiac arrest", category: "clinical", payload: { event: "code_blue" } },
];

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
  const [showInterventions, setShowInterventions] = useState(false);
  const [quickMessage, setQuickMessage] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>("patient");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus.state === "ready" || connectionStatus.state === "connecting";
  const isActive = connectionStatus.state === "ready" && voice.enabled;

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

  const handleScenarioEvent = (event: ScenarioEvent) => {
    emitCommand(sessionId, "scenario_event", event.payload);
    setFeedbackMsg(`Triggered: ${event.label}`);
  };

  const handleSendMessage = () => {
    if (!quickMessage.trim()) return;
    emitCommand(sessionId, "force_reply", { doctorUtterance: quickMessage.trim() }, selectedCharacter);
    setFeedbackMsg(`Sent to ${selectedCharacter}`);
    setQuickMessage("");
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

          {/* Interventions toggle - always available */}
          <button
            type="button"
            onClick={() => setShowInterventions(!showInterventions)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showInterventions
                ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-100"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            Patient Actions
          </button>
        </div>
      </div>

      {/* Feedback message */}
      {feedbackMsg && (
        <div className="text-xs text-emerald-300 bg-emerald-600/10 border border-emerald-500/30 rounded px-2 py-1">
          {feedbackMsg}
        </div>
      )}

      {/* Intervention controls - always available when toggled */}
      {showInterventions && (
        <div className="flex flex-col gap-3 bg-slate-950/50 rounded-lg border border-slate-800 p-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Presenter Controls
          </div>

          {/* Quick message to character */}
          <div className="flex gap-2">
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value as CharacterId)}
              className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
            >
              <option value="patient">Patient</option>
              <option value="parent">Parent</option>
              <option value="nurse">Nurse</option>
              <option value="tech">Tech</option>
              <option value="consultant">Consultant</option>
            </select>
            <input
              type="text"
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={`Instruct ${selectedCharacter}...`}
              className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!quickMessage.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-500/60 text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          {/* Scenario events grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Vitals */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Vitals</div>
              <div className="flex flex-wrap gap-1">
                {SCENARIO_EVENTS.filter((e) => e.category === "vitals").map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleScenarioEvent(event)}
                    title={event.description}
                    className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:border-slate-600 hover:bg-slate-700"
                  >
                    {event.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rhythm */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Rhythm</div>
              <div className="flex flex-wrap gap-1">
                {SCENARIO_EVENTS.filter((e) => e.category === "rhythm").map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleScenarioEvent(event)}
                    title={event.description}
                    className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:border-slate-600 hover:bg-slate-700"
                  >
                    {event.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clinical */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Clinical</div>
              <div className="flex flex-wrap gap-1">
                {SCENARIO_EVENTS.filter((e) => e.category === "clinical").map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleScenarioEvent(event)}
                    title={event.description}
                    className={`px-2 py-1 rounded text-[11px] font-semibold border hover:opacity-80 ${
                      event.id === "code"
                        ? "bg-rose-600/20 border-rose-500/60 text-rose-200"
                        : event.id === "improve"
                        ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-200"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    {event.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info message when not showing interventions */}
      {!showInterventions && (
        <div className="text-xs text-slate-500">
          Students interact via their phones. The AI responds automatically. Click "Patient Actions" to change patient state.
        </div>
      )}

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
