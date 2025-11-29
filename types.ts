export type SlideType = "content" | "question";

export interface Question {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Slide {
  id: string;
  index: number;
  type: SlideType;
  html: string;       // rendered into the slide area
  questionId?: string;
}

export interface SessionData {
  id?: string;        // Firestore doc id
  title: string;
  joinCode: string;
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