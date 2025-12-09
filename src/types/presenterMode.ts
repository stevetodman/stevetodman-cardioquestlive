/**
 * Presenter view modes - mutually exclusive views.
 * "slides" shows the presentation slides (full screen).
 * "sim" shows the patient simulation with voice controls.
 */
export type PresenterMode = "slides" | "sim";

export const PRESENTER_MODES: { id: PresenterMode; label: string; description: string }[] = [
  {
    id: "slides",
    label: "Slides",
    description: "Presentation slides, questions, scores",
  },
  {
    id: "sim",
    label: "Simulation",
    description: "Voice controls, patient simulation, transcripts",
  },
];

export const DEFAULT_PRESENTER_MODE: PresenterMode = "slides";
