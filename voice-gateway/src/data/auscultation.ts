import { PatientScenarioId } from "../messageTypes";

export type AuscultationClip = {
  type: "heart" | "lung";
  label: string;
  url: string;
  stageId?: string;
};

const CLIPS: AuscultationClip[] = [
  {
    type: "heart",
    label: "S1/S2 soft systolic murmur",
    url: "/audio/ausc/heart-soft-systolic.wav",
  },
  {
    type: "lung",
    label: "Clear breath sounds",
    url: "/audio/ausc/lungs-clear.wav",
  },
];

/**
  * Returns auscultation clips for a scenario/stage (static demo mapping).
  * Stage-specific clips can be added by setting stageId on entries.
  */
export function getAuscultationClips(scenarioId: PatientScenarioId, stageId?: string): AuscultationClip[] {
  // Demo: reuse the same baseline clips for all scenarios; extend as needed.
  return CLIPS.filter((clip) => !clip.stageId || clip.stageId === stageId);
}
