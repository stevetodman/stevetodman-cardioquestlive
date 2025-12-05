export type ClientRole = "presenter" | "participant";

export type ClientToServerMessage =
  | {
      type: "join";
      sessionId: string;
      userId: string;
      displayName?: string;
      role: ClientRole;
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
      commandType: "pause_ai" | "resume_ai" | "force_reply" | "end_turn" | "mute_user";
      payload?: Record<string, unknown>;
    }
  | {
      type: "ping";
      sessionId?: string;
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
      type: "pong";
    }
  | {
      type: "error";
      message: string;
    };
