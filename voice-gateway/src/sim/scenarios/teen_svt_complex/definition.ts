/**
 * Complex SVT Scenario - Teen with Supraventricular Tachycardia
 *
 * Patient: Alex Chen, 14-year-old female, 50kg
 * Chief Complaint: Episodes of rapid palpitations, currently in SVT
 * Teaching Focus: PALS SVT algorithm (vagal → adenosine → cardioversion)
 */

import type { SVTPhase } from "../../scenarioTypes";
import type { SVTExtendedState } from "../../types";

// ============================================================================
// SVT Phase Definition Type (differs from MyocarditisPhase structure)
// ============================================================================

export type SVTPhaseDef = {
  id: SVTPhase;
  name: string;
  durationMinutes?: number;
  vitalsTarget: { hr: number; bp: string; rr: number; spo2: number };
  examFindings: {
    general?: string;
    cardio?: string;
    lungs?: string;
    perfusion?: string;
    neuro?: string;
  };
  rhythmSummary?: string;
  stabilityRange?: [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
  drift?: {
    hrPerMin?: number;
    spo2PerMin?: number;
    sbpPerMin?: number;
    dbpPerMin?: number;
  };
  autoTransitions?: { to: SVTPhase; when: string }[];
};

// ============================================================================
// Phase Definitions
// ============================================================================

export const SVT_PHASES: SVTPhaseDef[] = [
  {
    id: "presentation",
    name: "Initial Presentation",
    durationMinutes: 2,
    vitalsTarget: { hr: 90, bp: "115/72", rr: 16, spo2: 99 },
    examFindings: {
      general: "Alert 14-year-old female, appears comfortable at rest.",
      cardio: "Regular rhythm, no murmurs, normal S1/S2.",
      lungs: "Clear to auscultation bilaterally.",
      perfusion: "Warm, well-perfused, brisk cap refill <2 seconds.",
      neuro: "Alert, oriented, no distress.",
    },
    rhythmSummary: "Normal sinus rhythm 90 bpm, normal intervals, no pre-excitation",
    stabilityRange: [1, 1],
    autoTransitions: [
      { to: "svt_onset", when: "time_in_phase_gte_2min" },
    ],
  },
  {
    id: "svt_onset",
    name: "SVT Episode",
    durationMinutes: 4, // Matches time_in_phase_gte_4min_no_treatment transition
    vitalsTarget: { hr: 220, bp: "105/68", rr: 20, spo2: 98 },
    examFindings: {
      general: "Anxious teen, clutching chest, visibly uncomfortable.",
      cardio: "Very rapid regular pulse, no murmurs audible.",
      lungs: "Clear, mild tachypnea.",
      perfusion: "Warm, slightly diaphoretic, cap refill 2 seconds.",
      neuro: "Alert, anxious, oriented.",
    },
    rhythmSummary: "SVT 220 bpm, narrow complex, regular, P waves not visible",
    stabilityRange: [1, 2],
    drift: {
      hrPerMin: 3,
      sbpPerMin: -2,
    },
    autoTransitions: [
      { to: "treatment_window", when: "any_treatment_attempted" },
      { to: "decompensating", when: "time_in_phase_gte_4min_no_treatment" },
    ],
  },
  {
    id: "treatment_window",
    name: "Active Treatment",
    durationMinutes: 5,
    vitalsTarget: { hr: 225, bp: "100/65", rr: 22, spo2: 97 },
    examFindings: {
      general: "Anxious, increasingly uncomfortable, requests relief.",
      cardio: "Rapid regular tachycardia, no gallop.",
      lungs: "Clear with mild tachypnea.",
      perfusion: "Warm but diaphoretic, cap refill 2-3 seconds.",
      neuro: "Alert, anxious, asking 'when will this stop?'",
    },
    rhythmSummary: "SVT 225 bpm, narrow complex, regular, ongoing",
    stabilityRange: [1, 2],
    drift: {
      hrPerMin: 2,
      sbpPerMin: -2,
      spo2PerMin: -0.5,
    },
    autoTransitions: [
      { to: "converted", when: "rhythm_converted" },
      { to: "cardioversion_decision", when: "adenosine_failed_twice" },
      { to: "decompensating", when: "stability_level_gte_3" },
    ],
  },
  {
    id: "cardioversion_decision",
    name: "Cardioversion Decision",
    durationMinutes: 3,
    vitalsTarget: { hr: 240, bp: "90/55", rr: 26, spo2: 95 },
    examFindings: {
      general: "Pale, diaphoretic, stating she feels 'really bad'.",
      cardio: "Very rapid, regular, weak pulses.",
      lungs: "Mild crackles at bases.",
      perfusion: "Cool extremities, delayed cap refill 3-4 seconds.",
      neuro: "Alert but foggy, slightly confused.",
    },
    rhythmSummary: "SVT 240 bpm, narrow complex, showing strain",
    stabilityRange: [2, 3],
    drift: {
      hrPerMin: 2,
      sbpPerMin: -3,
      spo2PerMin: -1,
    },
    autoTransitions: [
      { to: "converted", when: "rhythm_converted" },
      { to: "decompensating", when: "time_in_phase_gte_3min_no_cardioversion" },
    ],
  },
  {
    id: "decompensating",
    name: "Unstable SVT",
    durationMinutes: 5,
    vitalsTarget: { hr: 250, bp: "75/45", rr: 32, spo2: 92 },
    examFindings: {
      general: "Obtunded, severe distress, altered mental status.",
      cardio: "Rapid thready pulse, hypotensive.",
      lungs: "Increased work of breathing, bilateral crackles.",
      perfusion: "Cool, mottled, cap refill >4 seconds.",
      neuro: "Responds to voice but confused, drowsy.",
    },
    rhythmSummary: "SVT 250 bpm, patient hemodynamically unstable",
    stabilityRange: [3, 4],
    drift: {
      hrPerMin: 1,
      sbpPerMin: -2,
      spo2PerMin: -1.5,
    },
    autoTransitions: [
      { to: "converted", when: "rhythm_converted" },
    ],
  },
  {
    id: "converted",
    name: "Rhythm Converted",
    durationMinutes: 3,
    vitalsTarget: { hr: 95, bp: "112/70", rr: 16, spo2: 99 },
    examFindings: {
      general: "Relieved, color improving, calming down.",
      cardio: "Regular rhythm, normal rate, strong pulses.",
      lungs: "Clear.",
      perfusion: "Warm, pink, cap refill <2 seconds.",
      neuro: "Alert, oriented, 'that's so much better'.",
    },
    rhythmSummary: "Normal sinus rhythm 95 bpm, conversion successful",
    stabilityRange: [1, 1],
    // No drift - stable
  },
];

// ============================================================================
// Character Definitions
// ============================================================================

export type SVTCharacter = {
  id: string;
  name: string;
  role: "nurse" | "parent" | "patient";
  persona: string;
  clarificationPrompts?: Record<string, string>;
};

export const SVT_CHARACTERS: SVTCharacter[] = [
  {
    id: "patient",
    name: "Alex Chen",
    role: "patient",
    persona: `You are Alex Chen, a 14-year-old high school freshman.
Your heart suddenly started racing really fast - it's scary!
- When asked how you feel: "My heart is pounding so fast... I can feel it in my throat"
- When asked about onset: "It just started suddenly... I was just sitting in class"
- When asked about pain: "Not really pain... just feels like my heart is going crazy"
- When scared: "Is this going to stop? Am I going to be okay?"
- After adenosine: "Whoa... that felt so weird... like everything stopped for a second"
- After conversion: "Oh my god, it stopped! That's so much better!"
Keep answers conversational but brief (1-2 sentences). You're scared but trying to stay calm.`,
  },
  {
    id: "parent",
    name: "Mrs. Chen (Mother)",
    role: "parent",
    persona: `You are Alex's mother, very worried about your daughter.
History to share when asked:
- Alex has had episodes of "racing heart" before, maybe 3-4 times in the past year
- Episodes usually stop on their own after a few minutes
- This is the longest and scariest one - hasn't stopped in over 10 minutes
- Your mother (Alex's grandmother) has "WPW" and had a heart procedure
- Alex takes no medications, no allergies, healthy otherwise
- Born full-term, plays volleyball, good student

Your emotional progression:
- Early: "This has happened before but never this long. Is she okay?"
- During treatment: "What is that medicine? Will it hurt her?"
- If cardioversion: "You have to shock her heart?! Is that safe?"
- After conversion: "Thank goodness! What caused this? Will it happen again?"

Defer medical decisions to doctors but advocate for your daughter.`,
    clarificationPrompts: {
      history: "Has this happened before?",
      family_history: "Any heart problems in the family?",
      allergies: "Any allergies or medications?",
    },
  },
  {
    id: "nurse",
    name: "Nurse Martinez",
    role: "nurse",
    persona: `You are an experienced ED nurse helping manage this SVT patient.
You're calm, efficient, and supportive of the team.

For SVT management:
- Know the PALS algorithm: vagal → adenosine → cardioversion
- Adenosine: 0.1 mg/kg first (max 6mg), then 0.2 mg/kg (max 12mg)
- Adenosine must be rapid IV push with immediate flush
- Synchronized cardioversion: 0.5-2 J/kg, patient must be sedated

When orders are given, confirm and clarify:
- "Adenosine" → "Got it - 0.1 mg/kg is 5 mg for her. Rapid push with flush, right?"
- "Cardiovert" → "Setting up for synchronized cardioversion. What sedation do you want first?"
- "Vagal" → "I'll try modified Valsalva / ice to face. Which one?"

Provide clinical observations:
- "Heart rate is 220 and very regular - classic SVT pattern"
- "She's still hemodynamically stable - good perfusion"
- "BP is dropping a bit - 90 systolic now"`,
    clarificationPrompts: {
      adenosine: "What dose - 0.1 or 0.2 mg/kg? Rapid push with flush?",
      cardioversion: "What joules? And what sedation first?",
      vagal: "Modified Valsalva, ice to face, or bearing down?",
      sedation: "Midazolam, ketamine, or propofol for sedation?",
    },
  },
];

// ============================================================================
// Scoring Configuration
// ============================================================================

export const SVT_SCORING_CONFIG = {
  passingThreshold: 4, // Need 4 out of 5 checklist items

  checklistItems: [
    {
      id: "ecg_ordered",
      description: "Ordered 12-lead ECG",
      points: 20,
    },
    {
      id: "vagal_attempted",
      description: "Attempted vagal maneuvers before adenosine",
      points: 20,
    },
    {
      id: "adenosine_correct_dose",
      description: "Adenosine dosed correctly (0.1 mg/kg ±10%)",
      points: 20,
    },
    {
      id: "continuous_monitoring",
      description: "Patient on monitor during treatment",
      points: 20,
    },
    {
      id: "patient_reassured",
      description: "Reassured patient/parent during episode",
      points: 20,
    },
  ],

  bonuses: [
    { id: "early_ecg", description: "ECG ordered in first 60 seconds", points: 10, condition: "ecg_ordered_early" },
    { id: "first_dose_conversion", description: "Converted on first adenosine dose", points: 15, condition: "first_adenosine_worked" },
    { id: "vagal_conversion", description: "Converted with vagal maneuvers alone", points: 20, condition: "vagal_worked" },
    { id: "cardiology_consult", description: "Consulted cardiology", points: 10, condition: "cardiology_called" },
    { id: "proper_flush", description: "Mentioned rapid flush with adenosine", points: 5, condition: "flush_mentioned" },
    { id: "family_history_obtained", description: "Obtained family history (WPW)", points: 5, condition: "family_hx_asked" },
  ],

  penalties: [
    { id: "wrong_dose_low", description: "Adenosine dose too low (<0.05 mg/kg)", points: -10, condition: "adenosine_underdose" },
    { id: "wrong_dose_high", description: "Adenosine dose too high (>0.25 mg/kg)", points: -15, condition: "adenosine_overdose" },
    { id: "skipped_vagal", description: "Skipped vagal maneuvers (stable patient)", points: -5, condition: "no_vagal_stable" },
    { id: "delayed_treatment", description: "No treatment for >5 minutes", points: -15, condition: "treatment_delayed" },
    { id: "unsedated_cardioversion", description: "Cardioversion without sedation", points: -20, condition: "cardioversion_no_sedation" },
    { id: "reached_decompensation", description: "Patient decompensated", points: -15, condition: "patient_decompensated" },
    { id: "amiodarone_first", description: "Used amiodarone before adenosine", points: -10, condition: "amiodarone_first_line" },
  ],
};

// ============================================================================
// Scenario Definition Export
// ============================================================================

export const svtComplexScenario = {
  id: "teen_svt_complex_v1" as const,
  version: "1.0.0",
  scenarioType: "complex" as const,
  title: "Teen SVT - PALS Algorithm",
  description: "14-year-old with recurrent SVT. Focus: PALS algorithm execution, vagal maneuvers, proper adenosine dosing, decision-making for cardioversion.",
  runtimeMinutes: 15,
  demographics: {
    ageYears: 14,
    weightKg: 50,
    sex: "female" as const,
  },
  characters: SVT_CHARACTERS,
  phases: SVT_PHASES,
  initialPhase: "presentation" as SVTPhase,
  scoringConfig: SVT_SCORING_CONFIG,
};

// ============================================================================
// Helper: Create Initial SVT Extended State
// ============================================================================

export function createInitialSVTState(nowMs: number = Date.now()): SVTExtendedState {
  return {
    // Phase tracking
    phase: "presentation",
    phaseEnteredAt: nowMs,
    stabilityLevel: 1,

    // Rhythm state
    currentRhythm: "sinus",
    converted: false,

    // Treatment tracking
    vagalAttempts: 0,
    adenosineDoses: [],
    totalAdenosineMg: 0,
    cardioversionAttempts: [],

    // Intervention tracking
    ivAccess: false,
    monitorOn: false,
    sedationGiven: false,

    // Diagnostic tracking
    ecgOrdered: false,
    diagnostics: [],
    orderedDiagnostics: [],

    // Consults
    consults: [],
    consultsCalled: [],

    // Flags
    flags: {
      patientReassured: false,
      parentInformed: false,
      valsalvaExplained: false,
      reboundSVT: false,
      unsedatedCardioversion: false,
    },

    // Scenario clock
    scenarioStartedAt: nowMs,
    scenarioClockPaused: false,
    totalPausedMs: 0,

    // Rule tracking
    ruleTriggers: [],
    pendingEffects: [],

    // Scoring
    checklistCompleted: [],
    bonusesEarned: [],
    penaltiesIncurred: [],
    currentScore: 50, // Start at base score

    // Timeline
    timelineEvents: [
      {
        ts: nowMs,
        type: "phase_change",
        description: "Scenario started - Initial presentation",
      },
    ],
  };
}

export default svtComplexScenario;
