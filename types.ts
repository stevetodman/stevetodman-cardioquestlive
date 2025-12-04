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
