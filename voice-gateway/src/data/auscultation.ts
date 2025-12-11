import { PatientScenarioId } from "../messageTypes";

export type AuscultationClip = {
  type: "heart" | "lung";
  label: string;
  url: string;
  stageId?: string;
  scenarioId?: PatientScenarioId;
};

/**
 * Scenario-specific auscultation clips.
 * Participants listen via AirPods/headphones on iPhone.
 *
 * Audio files should be placed in /public/audio/ausc/ directory.
 * Format: .wav or .mp3, 5-15 seconds, clear quality
 */
const SCENARIO_CLIPS: Record<PatientScenarioId, AuscultationClip[]> = {
  // Teen scenarios - mostly normal/nonspecific
  syncope: [
    { type: "heart", label: "Normal S1/S2, no murmur", url: "/audio/ausc/heart-normal-teen.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  exertional_chest_pain: [
    { type: "heart", label: "S1/S2 regular, soft systolic murmur", url: "/audio/ausc/heart-soft-systolic.mp3" },
    { type: "lung", label: "Clear bilaterally", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  palpitations_svt: [
    { type: "heart", label: "Tachycardic, regular, no murmur", url: "/audio/ausc/heart-tachy-regular.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  arrhythmogenic_syncope: [
    { type: "heart", label: "Irregular rhythm, occasional ectopy", url: "/audio/ausc/heart-irregular-pvcs.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  exertional_syncope_hcm: [
    { type: "heart", label: "Harsh systolic murmur at LLSB, increases with Valsalva", url: "/audio/ausc/heart-hcm-murmur.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],

  // Pediatric/infant scenarios - pathologic findings
  myocarditis: [
    { type: "heart", label: "Distant heart sounds, gallop rhythm (S3)", url: "/audio/ausc/heart-gallop-s3.mp3" },
    { type: "lung", label: "Fine crackles at bases", url: "/audio/ausc/lungs-crackles.mp3" },
  ],
  kawasaki: [
    { type: "heart", label: "Tachycardic, hyperdynamic, possible friction rub", url: "/audio/ausc/heart-tachy-hyperdynamic.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  ductal_shock: [
    { type: "heart", label: "Single S2, continuous murmur (PDA if open)", url: "/audio/ausc/heart-infant-pda.mp3" },
    { type: "lung", label: "Grunting, increased work of breathing", url: "/audio/ausc/lungs-infant-distress.mp3" },
  ],
  coarctation_shock: [
    { type: "heart", label: "Gallop, systolic murmur between scapulae", url: "/audio/ausc/heart-coarct-murmur.mp3" },
    { type: "lung", label: "Tachypnea, mild crackles", url: "/audio/ausc/lungs-tachypnea.mp3" },
  ],
  cyanotic_spell: [
    { type: "heart", label: "Harsh systolic ejection murmur (RVOT obstruction)", url: "/audio/ausc/heart-tof-murmur.mp3" },
    { type: "lung", label: "Increased work of breathing during spell", url: "/audio/ausc/lungs-tachypnea.mp3" },
  ],
  // Complex SVT scenario
  teen_svt_complex_v1: [
    { type: "heart", label: "Very rapid regular rhythm ~220 bpm, no murmurs audible", url: "/audio/ausc/heart-svt-rapid.mp3" },
    { type: "lung", label: "Clear breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
  ],
  // Complex myocarditis scenario - progressive cardiogenic shock
  peds_myocarditis_silent_crash_v1: [
    { type: "heart", label: "Distant heart sounds, gallop rhythm (S3), tachycardia", url: "/audio/ausc/heart-gallop-s3.mp3" },
    { type: "lung", label: "Fine crackles at bases, increased work of breathing", url: "/audio/ausc/lungs-crackles.mp3" },
  ],
};

// Fallback clips if scenario not mapped
const DEFAULT_CLIPS: AuscultationClip[] = [
  { type: "heart", label: "Heart sounds", url: "/audio/ausc/heart-normal.mp3" },
  { type: "lung", label: "Breath sounds", url: "/audio/ausc/lungs-clear.mp3" },
];

/**
 * Returns auscultation clips for a scenario/stage.
 * Participants use AirPods/headphones to listen to heart/lung sounds during exam.
 */
export function getAuscultationClips(scenarioId: PatientScenarioId, stageId?: string): AuscultationClip[] {
  const clips = SCENARIO_CLIPS[scenarioId] ?? DEFAULT_CLIPS;

  // Stage-specific overrides (e.g., deteriorating patient has different sounds)
  if (stageId?.includes("decomp") || stageId?.includes("worse") || stageId?.includes("spell")) {
    // For decompensation stages, could return different clips
    // For now, return the scenario clips (can be extended)
    return clips;
  }

  return clips;
}
