export type ClientRole = "presenter" | "participant";

export type PatientScenarioId =
  | "exertional_chest_pain"
  | "syncope"
  | "palpitations_svt"
  | "myocarditis"
  | "exertional_syncope_hcm"
  | "ductal_shock"
  | "cyanotic_spell";

export type CharacterId = "patient" | "parent" | "nurse" | "tech" | "consultant";

export const ROLE_COLORS: Record<
  CharacterId | "doctor" | "patient",
  { text: string; border: string; bg?: string }
> = {
  patient: { text: "text-slate-100", border: "border-slate-600", bg: "bg-slate-800/70" },
  parent: { text: "text-rose-200", border: "border-rose-500/50", bg: "bg-rose-900/40" },
  nurse: { text: "text-emerald-200", border: "border-emerald-500/50", bg: "bg-emerald-900/40" },
  tech: { text: "text-sky-200", border: "border-sky-500/50", bg: "bg-sky-900/40" },
  consultant: { text: "text-indigo-200", border: "border-indigo-500/50", bg: "bg-indigo-900/40" },
  doctor: { text: "text-amber-200", border: "border-amber-500/60", bg: "bg-amber-900/30" },
};

export type DebriefTurn = {
  role: "doctor" | "patient";
  text: string;
  timestamp?: number;
};

export type VoiceConnectionState = "disconnected" | "connecting" | "ready" | "error";

export type VoiceConnectionStatus = {
  state: VoiceConnectionState;
  reason?: "socket_error" | "closed" | "unsupported" | "unknown";
  lastChangedAt?: number;
};

export type AnalysisResult = {
  summary: string;
  strengths: string[];
  opportunities: string[];
  teachingPoints: string[];
};

export type ClientToServerMessage =
  | {
      type: "join";
      sessionId: string;
      userId: string;
      displayName?: string;
      role: ClientRole;
      authToken?: string;
    }
  | {
      type: "start_speaking";
      sessionId: string;
      userId: string;
      character?: CharacterId;
    }
  | {
      type: "stop_speaking";
      sessionId: string;
      userId: string;
      character?: CharacterId;
    }
  | {
      type: "voice_command";
      sessionId: string;
      userId: string;
      character?: CharacterId;
      commandType:
        | "pause_ai"
        | "resume_ai"
        | "force_reply"
        | "end_turn"
        | "mute_user"
        | "freeze"
        | "unfreeze"
        | "skip_stage"
        | "order"
        | "exam"
        | "toggle_telemetry"
        | "show_ekg"
        | "treatment";
      payload?: Record<string, unknown>;
    }
  | {
      type: "ping";
      sessionId?: string;
    }
  | {
      type: "doctor_audio";
      sessionId: string;
      userId: string;
      character?: CharacterId;
      audioBase64: string;
      contentType: string;
    }
  | {
      type: "set_scenario";
      sessionId: string;
      userId: string;
      scenarioId: PatientScenarioId;
    }
  | {
      type: "analyze_transcript";
      sessionId: string;
      userId: string;
      turns: DebriefTurn[];
    };

export type ServerToClientMessage =
  | {
      type: "joined";
      sessionId: string;
      role: ClientRole;
    }
  | {
      type: "participant_state";
      sessionId: string;
      userId: string;
      speaking: boolean;
      character?: CharacterId;
    }
  | {
      type: "patient_state";
      sessionId: string;
      state: "idle" | "listening" | "speaking" | "error";
      character?: CharacterId;
      displayName?: string;
    }
  | {
      type: "patient_transcript_delta";
      sessionId: string;
      text: string;
      character?: CharacterId;
    }
  | {
      type: "patient_audio";
      sessionId: string;
      audioBase64: string;
      character?: CharacterId;
    }
  | {
      type: "doctor_utterance";
      sessionId: string;
      userId: string;
      text: string;
      character?: CharacterId;
    }
  | {
      type: "scenario_changed";
      sessionId: string;
      scenarioId: PatientScenarioId;
    }
  | {
      type: "analysis_result";
      sessionId: string;
      summary: string;
      strengths: string[];
      opportunities: string[];
      teachingPoints: string[];
    }
  | {
      type: "sim_state";
      sessionId: string;
      stageId: string;
      stageIds?: string[];
      scenarioId?: PatientScenarioId;
      vitals: Record<string, unknown>;
      exam?: Record<string, string | undefined>;
      telemetry?: boolean;
      rhythmSummary?: string;
      telemetryWaveform?: number[];
      findings?: string[];
      fallback: boolean;
      budget?: { usdEstimate?: number; voiceSeconds?: number; throttled?: boolean; fallback?: boolean };
      orders?: { id: string; type: "vitals" | "ekg" | "labs" | "imaging"; status: "pending" | "complete"; result?: any; completedAt?: number }[];
      ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
      telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
    }
  | {
      type: "pong";
    }
  | {
      type: "error";
      message: string;
    };

export type PatientState = "idle" | "listening" | "speaking" | "error";
export type GatewayStatus = "disconnected" | "connecting" | "connected";
