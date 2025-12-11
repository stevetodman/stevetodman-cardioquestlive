export type ClientRole = "presenter" | "participant";

export type CharacterId = "patient" | "parent" | "nurse" | "tech" | "consultant" | "imaging";

export type OrderType = "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access";

export type OrderResult = {
  type: OrderType;
  summary?: string;
  hr?: number;
  bp?: string;
  rr?: number;
  spo2?: number;
  temp?: number;
  imageUrl?: string;
  meta?: { rate?: string; axis?: string; intervals?: string };
  abnormal?: string;
  nextAction?: string;
  rationale?: string;
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
        | "treatment"
        | "scenario_event";
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

export type PatientScenarioId =
  | "exertional_chest_pain"
  | "syncope"
  | "palpitations_svt"
  | "myocarditis"
  | "exertional_syncope_hcm"
  | "ductal_shock"
  | "cyanotic_spell"
  | "kawasaki"
  | "coarctation_shock"
  | "arrhythmogenic_syncope"
  | "teen_svt_complex_v1"
  | "peds_myocarditis_silent_crash_v1";

export type DebriefTurn = {
  role: "doctor" | "patient";
  text: string;
  timestamp?: number;
};

export type ServerToClientMessage =
  | {
      type: "joined";
      sessionId: string;
      role: ClientRole;
      insecureMode?: boolean;
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
      stageEnteredAt?: number;
      scenarioId?: PatientScenarioId;
      vitals: Record<string, unknown>;
      exam?: Record<string, string | undefined>;
      examAudio?: { type: "heart" | "lung"; label: string; url: string; stageId?: string }[];
      telemetry?: boolean;
      rhythmSummary?: string;
      telemetryWaveform?: number[];
      findings?: string[];
      fallback: boolean;
      voiceFallback?: boolean;
      correlationId?: string;
      budget?: {
        usdEstimate?: number;
        voiceSeconds?: number;
        throttled?: boolean;
        fallback?: boolean;
      };
      orders?: { id: string; type: OrderType; status: "pending" | "complete"; result?: OrderResult; completedAt?: number }[];
      ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
      telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
      treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
    }
  | {
      type: "pong";
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "voice_error";
      sessionId: string;
      error: "tts_failed" | "stt_failed" | "openai_failed";
      correlationId: string;
      detail?: string;
    }
  | {
      type: "complex_debrief_result";
      sessionId: string;
      scenarioId: "teen_svt_complex_v1" | "peds_myocarditis_silent_crash_v1";
      summary: string;
      strengths: string[];
      opportunities: string[];
      teachingPoints: string[];
      passed: boolean;
      grade: "A" | "B" | "C" | "D" | "F";
      checklistScore: string;
      checklistResults: {
        description: string;
        achieved: boolean;
        explanation: string;
      }[];
      bonuses: { description: string; points: number }[];
      penalties: { description: string; points: number }[];
      totalPoints: number;
      timeline: {
        timeMs: number;
        timeFormatted: string;
        type: string;
        description: string;
        isGood?: boolean;
        isBad?: boolean;
      }[];
      scenarioSpecificFeedback: string[];
    };
