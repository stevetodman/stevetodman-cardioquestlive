export type ClientRole = "presenter" | "participant";

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
    }
  | {
      type: "stop_speaking";
      sessionId: string;
      userId: string;
    }
  | {
      type: "voice_command";
      sessionId: string;
      userId: string;
      commandType: "pause_ai" | "resume_ai" | "force_reply" | "end_turn" | "mute_user" | "freeze" | "unfreeze" | "skip_stage";
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
  | "palpitations_svt";

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
    }
  | {
      type: "participant_state";
      sessionId: string;
      userId: string;
      speaking: boolean;
    }
  | {
      type: "patient_state";
      sessionId: string;
      state: "idle" | "listening" | "speaking" | "error";
    }
  | {
      type: "patient_transcript_delta";
      sessionId: string;
      text: string;
    }
  | {
      type: "patient_audio";
      sessionId: string;
      audioBase64: string;
    }
  | {
      type: "doctor_utterance";
      sessionId: string;
      userId: string;
      text: string;
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
      fallback: boolean;
      budget?: {
        usdEstimate?: number;
        voiceSeconds?: number;
        throttled?: boolean;
        fallback?: boolean;
      };
    }
  | {
      type: "pong";
    }
  | {
      type: "error";
      message: string;
    };
