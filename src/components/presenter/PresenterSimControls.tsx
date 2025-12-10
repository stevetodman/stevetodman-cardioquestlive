/**
 * Simulation controls panel for presenter view.
 * Extracted from PresenterSession to reduce file size and token consumption.
 */

import React from "react";
import type { PatientScenarioId, VoiceConnectionStatus, CharacterId } from "../../types/voiceGateway";
import type { TranscriptTurn } from "../VoicePatientOverlay";
import { ROLE_COLORS } from "../../types/voiceGateway";

// ============================================================================
// Types
// ============================================================================

export interface SimOrder {
  id: string;
  type: "vitals" | "ekg" | "labs" | "imaging";
  status: "pending" | "complete";
  result?: {
    summary?: string;
    type?: string;
    hr?: number;
    bp?: string;
    spo2?: number;
    imageUrl?: string;
  };
  completedAt?: number;
}

export interface ScenarioOption {
  id: PatientScenarioId;
  label: string;
}

export interface PresenterSimControlsProps {
  // Scenario
  selectedScenario: PatientScenarioId;
  scenarioOptions: ScenarioOption[];
  onScenarioChange: (id: PatientScenarioId) => void;

  // Connection status
  gatewayStatus: VoiceConnectionStatus;

  // Sim state
  simState: {
    stageId?: string;
    stageIds?: string[];
    orders?: SimOrder[];
  } | null;

  // Freeze control
  freezeStatus: "live" | "frozen";
  onFreezeToggle: (action: "freeze" | "unfreeze") => void;

  // Actions
  onForceReply: () => void;
  onRevealClue: () => void;
  onSkipStage: () => void;

  // Stage selection
  availableStages: string[];
  selectedStage: string;
  onStageSelect: (stage: string) => void;

  // Transcript
  transcriptTurns: TranscriptTurn[];

  // UI state
  showInterventions: boolean;
  onToggleInterventions: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function roleColor(role: string): string {
  const colors = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  if (colors) {
    return `${colors.border} ${colors.text} ${colors.bg}`;
  }
  return "border-slate-700 text-slate-200 bg-slate-800";
}

interface TranscriptGroup {
  key: string;
  turns: TranscriptTurn[];
}

function groupTranscriptByRole(turns: TranscriptTurn[]): TranscriptGroup[] {
  const groups = new Map<string, TranscriptTurn[]>();
  for (const turn of turns) {
    const key = turn.role ?? "unknown";
    const existing = groups.get(key) ?? [];
    existing.push(turn);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([key, turnList]) => ({ key, turns: turnList }));
}

// ============================================================================
// Component
// ============================================================================

export function PresenterSimControls({
  selectedScenario,
  scenarioOptions,
  onScenarioChange,
  gatewayStatus,
  simState,
  freezeStatus,
  onFreezeToggle,
  onForceReply,
  onRevealClue,
  onSkipStage,
  availableStages,
  selectedStage,
  onStageSelect,
  transcriptTurns,
  showInterventions,
  onToggleInterventions,
}: PresenterSimControlsProps) {
  const groupedTranscript = groupTranscriptByRole(transcriptTurns);
  const stageOptions = availableStages.length ? availableStages : (simState?.stageIds ?? []);

  return (
    <div className="flex flex-col gap-3">
      {/* Simplified Sim Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100 space-y-4">
        {/* Case selector and status */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label htmlFor="sim-case-select" className="text-sm font-semibold text-slate-200">
              Patient Case
            </label>
            <select
              id="sim-case-select"
              value={selectedScenario}
              onChange={(e) => onScenarioChange(e.target.value as PatientScenarioId)}
              className="text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-w-[240px]"
            >
              {scenarioOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                gatewayStatus.state === "ready"
                  ? "bg-emerald-500"
                  : gatewayStatus.state === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-rose-500"
              }`}
              title={
                gatewayStatus.state === "ready"
                  ? "Voice connected"
                  : gatewayStatus.state === "connecting"
                  ? "Connecting..."
                  : "Voice disconnected"
              }
            />
            <button
              type="button"
              onClick={onToggleInterventions}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                showInterventions
                  ? "bg-amber-600 text-white border border-amber-500"
                  : "bg-amber-600/20 text-amber-100 border border-amber-500/60 hover:bg-amber-600/30"
              }`}
            >
              Intervene
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Students interact via their phones. The AI responds automatically. Click "Intervene" to change patient state.
        </div>

        {/* Intervention controls */}
        {showInterventions && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onFreezeToggle(freezeStatus === "frozen" ? "unfreeze" : "freeze")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  freezeStatus === "frozen"
                    ? "bg-emerald-700 text-emerald-50 hover:bg-emerald-600"
                    : "bg-amber-700 text-amber-50 hover:bg-amber-600"
                }`}
              >
                {freezeStatus === "frozen" ? "Unfreeze" : "Freeze"}
              </button>
              <button
                type="button"
                onClick={onForceReply}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-700 text-sky-50 hover:bg-sky-600"
              >
                Force reply
              </button>
              <button
                type="button"
                onClick={onRevealClue}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-700 text-purple-50 hover:bg-purple-600"
              >
                Reveal clue
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="stage-select" className="text-xs text-slate-400">
                Stage:
              </label>
              <select
                id="stage-select"
                value={selectedStage}
                onChange={(e) => onStageSelect(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
              >
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onSkipStage}
                disabled={!selectedStage}
                className="px-2 py-1 rounded text-xs font-semibold bg-slate-700 text-slate-50 hover:bg-slate-600 disabled:opacity-50"
              >
                Skip
              </button>
              <span className="text-xs text-slate-500">Current: {simState?.stageId ?? "—"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Orders & Status */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Orders & Status</div>
          <div className="text-[10px] text-slate-500">
            {simState?.orders?.length ? `${simState.orders.length} orders` : "No orders yet"}
          </div>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(simState?.orders ?? []).length === 0 ? (
            <div className="text-xs text-slate-500">Waiting for student orders...</div>
          ) : (
            (simState?.orders ?? []).map((o) => (
              <div
                key={o.id}
                className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em] ${
                    o.status === "complete"
                      ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {o.type} {o.status}
                </span>
                <div className="text-slate-100 leading-snug">
                  {o.result?.summary ||
                    (o.result?.type === "vitals"
                      ? `HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`
                      : "In progress")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transcript by role */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Transcript (by role)</div>
          <div className="text-[10px] text-slate-500">Latest turns per role</div>
        </div>
        {groupedTranscript.length === 0 ? (
          <div className="text-xs text-slate-500">No transcript yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {groupedTranscript.map((group) => (
              <div key={group.key} className="space-y-1">
                <div
                  className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded border ${roleColor(
                    group.key
                  )}`}
                >
                  {group.key}
                </div>
                {group.turns.slice(-3).map((turn) => (
                  <div
                    key={turn.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  >
                    <div className="text-[10px] text-slate-500 mb-1">
                      {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }) : "—"}
                    </div>
                    <div className="leading-snug whitespace-pre-wrap">{turn.text}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
