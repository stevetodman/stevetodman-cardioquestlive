export type SlideType = "content" | "question";

export interface Question {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface Slide {
  id: string;
  index: number;
  type: SlideType;
  html: string;       // rendered into the slide area
  questionId?: string;
}

export interface DeckData {
  title: string;
  slides: Slide[];
  questions: Question[];
  updatedAt?: string;
}

export interface SessionData {
  id?: string;        // Firestore doc id
  title: string;
  joinCode: string;
  createdBy?: string; // required in Firestore; optional until set client-side
  currentSlideIndex: number;
  currentQuestionId: string | null;
  showResults: boolean;
  slides: Slide[];
  questions: Question[];
  createdAt: string;  // ISO string
  voice?: VoiceState;
}

export interface ResponseDoc {
  id?: string;
  sessionId: string;
  userId: string;
  questionId: string;
  choiceIndex: number;
  createdAt: string;
}

export interface ParticipantDoc {
  userId: string;
  sessionId: string;
  teamId: string;
  teamName: string;
  points: number;
  streak: number;
  correctCount: number;
  incorrectCount: number;
  createdAt: string;
}

// Shared tile data for interactive clue grids / phenotype slides
export interface ClueTile {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export type VoiceMode = "idle" | "resident-speaking" | "ai-speaking";

export interface VoiceState {
  enabled: boolean;
  floorHolderId: string | null;
  floorHolderName: string | null;
  since: any; // Firestore Timestamp | null; kept loose for mock compatibility
  mode: VoiceMode;
  locked?: boolean;
}

export type VoiceCommandType =
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

export interface VoiceCommandDoc {
  type: VoiceCommandType;
  createdAt: any;
  createdBy: string;
  payload?: Record<string, any>;
  character?: string;
}
