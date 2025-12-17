/**
 * SimulationContext - Manages core simulation state for presenter/participant views.
 * Extracted from PresenterSession to reduce component complexity and enable state sharing.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import {
  PatientState,
  PatientScenarioId,
  VoiceConnectionStatus,
  CharacterId,
} from "../types/voiceGateway";
import type { Interventions } from "../components/PatientStatusOutline";

/** Order type from the simulation */
export type SimOrderType = "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access";

/** Order from the simulation */
export interface SimOrder {
  id: string;
  type: SimOrderType;
  status: "pending" | "complete";
  result?: Record<string, unknown>;
  completedAt?: number;
  orderedBy?: { id: string; name: string; role: string };
}

/** Budget state from the simulation */
export interface BudgetState {
  usdEstimate?: number;
  voiceSeconds?: number;
  throttled?: boolean;
  fallback?: boolean;
}

/** Extended state for complex scenarios */
export interface ExtendedState {
  phase?: string;
  phaseEnteredAt?: number;
  currentScore?: number;
  checklistCompleted?: string[];
  bonusesEarned?: string[];
  penaltiesIncurred?: string[];
  timelineEvents?: Array<{ ts: number; type: string; description: string }>;
  [key: string]: unknown;
}

/** Core simulation state */
export interface SimState {
  stageId: string;
  stageIds?: string[];
  scenarioId?: PatientScenarioId;
  vitals: Record<string, unknown>;
  exam?: Record<string, string | undefined>;
  interventions?: Interventions;
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  fallback: boolean;
  voiceFallback?: boolean;
  correlationId?: string;
  findings?: string[];
  budget?: BudgetState;
  orders?: SimOrder[];
  stageEnteredAt?: number;
  scenarioStartedAt?: number;
  extended?: ExtendedState;
  elapsedSeconds?: number;
}

/** Transcript log entry */
export interface TranscriptLogTurn {
  id: string;
  timestamp: number;
  text: string;
  character: CharacterId | "doctor" | "system";
  audioUrl?: string;
}

/** Active character state */
export interface ActiveCharacterState {
  character: CharacterId;
  state: PatientState;
}

/** Simulation context value */
export interface SimulationContextValue {
  // Core state
  simState: SimState | null;
  setSimState: React.Dispatch<React.SetStateAction<SimState | null>>;

  // Voice/connection state
  patientState: PatientState;
  setPatientState: React.Dispatch<React.SetStateAction<PatientState>>;
  gatewayStatus: VoiceConnectionStatus;
  setGatewayStatus: React.Dispatch<React.SetStateAction<VoiceConnectionStatus>>;
  activeCharacter: ActiveCharacterState | null;
  setActiveCharacter: React.Dispatch<React.SetStateAction<ActiveCharacterState | null>>;
  voiceLocked: boolean;
  setVoiceLocked: React.Dispatch<React.SetStateAction<boolean>>;

  // Scenario selection
  selectedScenario: PatientScenarioId;
  setSelectedScenario: React.Dispatch<React.SetStateAction<PatientScenarioId>>;
  availableStages: string[];
  setAvailableStages: React.Dispatch<React.SetStateAction<string[]>>;
  selectedStage: string;
  setSelectedStage: React.Dispatch<React.SetStateAction<string>>;

  // Transcript
  transcriptLog: TranscriptLogTurn[];
  setTranscriptLog: React.Dispatch<React.SetStateAction<TranscriptLogTurn[]>>;
  patientAudioUrl: string | null;
  setPatientAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;

  // Alerts
  budgetAlert: { level: "soft" | "hard"; message: string } | null;
  setBudgetAlert: React.Dispatch<React.SetStateAction<{ level: "soft" | "hard"; message: string } | null>>;
  alarmNotice: string | null;
  setAlarmNotice: React.Dispatch<React.SetStateAction<string | null>>;
  rhythmAlert: string | null;
  setRhythmAlert: React.Dispatch<React.SetStateAction<string | null>>;

  // Controls
  freezeStatus: "live" | "frozen";
  setFreezeStatus: React.Dispatch<React.SetStateAction<"live" | "frozen">>;
  targetCharacter: CharacterId;
  setTargetCharacter: React.Dispatch<React.SetStateAction<CharacterId>>;

  // Scoring
  scoringTrend: { current: number; delta: number };
  setScoringTrend: React.Dispatch<React.SetStateAction<{ current: number; delta: number }>>;

  // Helpers
  isConnected: boolean;
  isComplexScenario: boolean;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
}

export function useSimulationOptional(): SimulationContextValue | null {
  return useContext(SimulationContext);
}

interface SimulationProviderProps {
  children: ReactNode;
  sessionId?: string;
}

export function SimulationProvider({ children, sessionId }: SimulationProviderProps) {
  // Core simulation state
  const [simState, setSimState] = useState<SimState | null>(null);

  // Voice/connection state
  const [patientState, setPatientState] = useState<PatientState>("idle");
  const [gatewayStatus, setGatewayStatus] = useState<VoiceConnectionStatus>({
    state: "disconnected",
    lastChangedAt: Date.now(),
  });
  const [activeCharacter, setActiveCharacter] = useState<ActiveCharacterState | null>(null);
  const [voiceLocked, setVoiceLocked] = useState(false);

  // Scenario selection
  const [selectedScenario, setSelectedScenario] = useState<PatientScenarioId>("teen_svt_complex_v1");
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");

  // Transcript
  const [transcriptLog, setTranscriptLog] = useState<TranscriptLogTurn[]>([]);
  const [patientAudioUrl, setPatientAudioUrl] = useState<string | null>(null);

  // Alerts
  const [budgetAlert, setBudgetAlert] = useState<{ level: "soft" | "hard"; message: string } | null>(null);
  const [alarmNotice, setAlarmNotice] = useState<string | null>(null);
  const [rhythmAlert, setRhythmAlert] = useState<string | null>(null);

  // Controls
  const [freezeStatus, setFreezeStatus] = useState<"live" | "frozen">("live");
  const [targetCharacter, setTargetCharacter] = useState<CharacterId>("patient");

  // Scoring
  const [scoringTrend, setScoringTrend] = useState<{ current: number; delta: number }>({ current: 0, delta: 0 });

  // Computed values
  const isConnected = gatewayStatus.state === "connected";
  const isComplexScenario = selectedScenario === "teen_svt_complex_v1" ||
                            selectedScenario === "peds_myocarditis_silent_crash_v1" ||
                            (simState?.scenarioId === "teen_svt_complex_v1") ||
                            (simState?.scenarioId === "peds_myocarditis_silent_crash_v1");

  const value: SimulationContextValue = {
    simState,
    setSimState,
    patientState,
    setPatientState,
    gatewayStatus,
    setGatewayStatus,
    activeCharacter,
    setActiveCharacter,
    voiceLocked,
    setVoiceLocked,
    selectedScenario,
    setSelectedScenario,
    availableStages,
    setAvailableStages,
    selectedStage,
    setSelectedStage,
    transcriptLog,
    setTranscriptLog,
    patientAudioUrl,
    setPatientAudioUrl,
    budgetAlert,
    setBudgetAlert,
    alarmNotice,
    setAlarmNotice,
    rhythmAlert,
    setRhythmAlert,
    freezeStatus,
    setFreezeStatus,
    targetCharacter,
    setTargetCharacter,
    scoringTrend,
    setScoringTrend,
    isConnected,
    isComplexScenario,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
