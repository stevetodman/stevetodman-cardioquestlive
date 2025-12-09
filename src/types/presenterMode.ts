/**
 * Presenter view modes for focused UI sections.
 * Each mode shows relevant controls while hiding others to reduce clutter.
 */
export type PresenterMode = "presentation" | "voice" | "gamification";

export const PRESENTER_MODES: { id: PresenterMode; label: string; description: string }[] = [
  {
    id: "presentation",
    label: "Presentation",
    description: "Slide view with question controls",
  },
  {
    id: "voice",
    label: "Voice & Sim",
    description: "Voice controls, patient simulation, transcripts",
  },
  {
    id: "gamification",
    label: "Scores",
    description: "Team scores, leaderboards, session stats",
  },
];

export const DEFAULT_PRESENTER_MODE: PresenterMode = "presentation";
