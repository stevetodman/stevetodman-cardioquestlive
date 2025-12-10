/**
 * "The Silent Crash" - Acute Fulminant Myocarditis Scenario
 *
 * Patient: Jordan Lane, 10-year-old, 32kg
 * Chief Complaint: "Not feeling well" after viral illness
 * Underlying: Acute fulminant myocarditis with cardiogenic shock
 */

import type { ComplexScenarioDef, PhaseDef, ComplexCharacter } from "../../scenarioTypes";
import { MYOCARDITIS_PHYSIOLOGY_RULES } from "../../physiologyEngine";

// ============================================================================
// Phase Definitions
// ============================================================================

const phases: PhaseDef[] = [
  {
    id: "scene_set",
    name: "Initial Presentation",
    durationMinutes: 1,
    vitalsTarget: { hr: 115, bp: "88/52", rr: 28, spo2: 94 },
    examFindings: {
      general: "Tired-appearing 10-year-old, mildly tachypneic, prefers sitting upright.",
      cardio: "Tachycardic, distant heart sounds, possible S3 gallop, no murmur.",
      lungs: "Bibasilar crackles, mild subcostal retractions.",
      perfusion: "Cool extremities, cap refill 3-4 seconds, weak peripheral pulses.",
      neuro: "Sleepy but oriented x3, answers appropriately when engaged.",
    },
    rhythmSummary: "Sinus tachycardia 115 bpm, low voltage QRS, diffuse ST-T wave abnormalities",
    shockStageRange: [1, 1],
    drift: {
      hrPerMin: 2, // Gradual worsening
      spo2PerMin: -0.5,
    },
    autoTransitions: [
      { to: "recognition", when: [{ type: "time_in_phase_gte", minutes: 1 }] },
    ],
  },
  {
    id: "recognition",
    name: "Workup Phase",
    durationMinutes: 5,
    vitalsTarget: { hr: 125, bp: "82/48", rr: 32, spo2: 92 },
    examFindings: {
      general: "More fatigued, diaphoretic, increased work of breathing.",
      cardio: "Tachycardic with S3 gallop, +JVD.",
      lungs: "Worsening crackles, using accessory muscles.",
      perfusion: "Cool and mottled, cap refill 4-5 seconds.",
      neuro: "Sleepy, oriented but slower to respond.",
    },
    rhythmSummary: "Sinus tachycardia 125 bpm, low voltage, ST depression V4-V6",
    shockStageRange: [1, 2],
    drift: {
      hrPerMin: 3,
      spo2PerMin: -1,
      sbpPerMin: -2,
    },
    nurseTriggers: [
      { condition: "spo2 < 90", line: "SpO2 is dropping to 89. Should we put them on oxygen?" },
      { condition: "bp_systolic < 80", line: "BP is 78 systolic. They look worse." },
    ],
    autoTransitions: [
      { to: "decompensation", when: [{ type: "time_in_phase_gte", minutes: 5 }] },
      { to: "decompensation", when: [{ type: "shock_stage_gte", stage: 2 }] },
    ],
  },
  {
    id: "decompensation",
    name: "Decompensation",
    durationMinutes: 9,
    vitalsTarget: { hr: 145, bp: "72/40", rr: 40, spo2: 88 },
    examFindings: {
      general: "Ill-appearing, diaphoretic, tripoding to breathe.",
      cardio: "Tachycardic with S3, weak pulses, +hepatomegaly.",
      lungs: "Diffuse crackles, severe retractions, nasal flaring.",
      perfusion: "Mottled, delayed cap refill >5 seconds, thready pulses.",
      neuro: "Lethargic, answers only to direct questions.",
    },
    rhythmSummary: "Sinus tachycardia 145 bpm, low voltage, frequent PVCs, ST depressions",
    shockStageRange: [2, 3],
    drift: {
      hrPerMin: 2,
      spo2PerMin: -1.5,
      sbpPerMin: -3,
    },
    nurseTriggers: [
      { condition: "no_picu_called && time > 3min", line: "Doctor, should we call the PICU? This kid is getting sicker." },
      { condition: "bp_systolic < 65", line: "BP is 64/38! We're losing them!" },
    ],
    autoTransitions: [
      { to: "intubation_trap", when: [{ type: "time_in_phase_gte", minutes: 9 }] },
      { to: "intubation_trap", when: [{ type: "airway_intervention", method: "intubation" }] },
    ],
  },
  {
    id: "intubation_trap",
    name: "Airway Decision",
    durationMinutes: 10,
    vitalsTarget: { hr: 155, bp: "65/35", rr: 48, spo2: 85 },
    examFindings: {
      general: "Obtunded, severe respiratory distress.",
      cardio: "Profound tachycardia, S3 gallop, JVD to jaw.",
      lungs: "Pulmonary edema, pink frothy secretions.",
      perfusion: "Ashen, no palpable peripheral pulses, cap refill >6 seconds.",
      neuro: "Responds only to painful stimuli.",
    },
    rhythmSummary: "Sinus tachycardia 155 bpm, runs of VT, ST depressions, low voltage",
    shockStageRange: [3, 4],
    drift: {
      hrPerMin: 1,
      spo2PerMin: -2,
      sbpPerMin: -2,
    },
    nurseTriggers: [
      { condition: "intubation_planned", line: "Getting ready to intubate. What induction agent do you want? Do you have a pressor at bedside?" },
      { condition: "intubation_collapse", line: "BP crashed! 40 systolic! They're bradying down!" },
    ],
    autoTransitions: [
      { to: "confirmation_disposition", when: [{ type: "time_in_phase_gte", minutes: 10 }] },
      { to: "confirmation_disposition", when: [{ type: "consult_called", service: "ecmo" }] },
    ],
  },
  {
    id: "confirmation_disposition",
    name: "Confirmation & Disposition",
    durationMinutes: 5,
    vitalsTarget: { hr: 140, bp: "75/45", rr: 24, spo2: 92 },
    examFindings: {
      general: "Intubated, sedated, on inotropic support.",
      cardio: "Tachycardic, S3 present, palpable central pulses.",
      lungs: "Crackles clearing slightly with PEEP.",
      perfusion: "Less mottled, cap refill improving to 4 seconds.",
      neuro: "Sedated, follows commands intermittently.",
    },
    rhythmSummary: "Sinus tachycardia 140 bpm on epi, PVCs decreased, ST changes persistent",
    shockStageRange: [3, 5],
    drift: {
      // Stabilizing - no drift
    },
    nurseTriggers: [
      { condition: "echo_ordered", line: "Echo tech is here. They're setting up now." },
    ],
    autoTransitions: [
      { to: "end", when: [{ type: "time_in_phase_gte", minutes: 5 }] },
    ],
  },
  {
    id: "end",
    name: "Scenario Complete",
    vitalsTarget: { hr: 130, bp: "85/50", rr: 20, spo2: 95 },
    examFindings: {
      general: "Stabilized on mechanical ventilation and inotropes.",
      cardio: "Improved pulses, S3 still present.",
      lungs: "Improving crackles.",
      perfusion: "Warmer, cap refill 3 seconds.",
      neuro: "Sedated, responsive.",
    },
    rhythmSummary: "Sinus tachycardia 130 bpm, improved voltage, fewer PVCs",
    shockStageRange: [4, 5],
  },
];

// ============================================================================
// Character Definitions
// ============================================================================

const characters: ComplexCharacter[] = [
  {
    id: "patient",
    name: "Jordan Lane",
    role: "patient",
    persona: `You are Jordan Lane, a 10-year-old who has been sick for a few days after a cold.
You feel very tired and can't catch your breath. You don't have much energy to talk.
- If asked how you feel: "Tired... hard to breathe... my chest feels heavy"
- If asked about pain: "My chest kind of hurts... and my tummy"
- If asked about the cold: "Had a cold last week... then started feeling really bad"
- If scared or in distress: Look at your mom, say "Mom... I don't feel good"
Keep answers SHORT (5-10 words). You're too tired to say much.`,
  },
  {
    id: "parent",
    name: "Ms. Lane (Mother)",
    role: "parent",
    persona: `You are Jordan's mother, increasingly worried about your child.
History to share when asked:
- Viral illness 5-7 days ago (runny nose, cough, low fever)
- Jordan has been "not themselves" for 2-3 days
- Decreased appetite, sleeping more than usual
- Today: wouldn't get out of bed, breathing fast, looked pale
- No known cardiac history, no medications, no allergies
- Born full-term, normal development, plays soccer

As Jordan gets sicker, you become more anxious:
- Early: "Is Jordan going to be okay? They've never been this sick."
- Middle: "Why isn't Jordan getting better? What's happening?"
- Late: "Please help my baby! What's wrong with them?"

You can provide history but defer medical decisions to the doctors.`,
    clarificationPrompts: {
      history: "When did Jordan first get sick? Tell me about the last week.",
      allergies: "Any allergies or medications?",
      birth_history: "Any problems when Jordan was born?",
    },
  },
  {
    id: "nurse",
    name: "Nurse Taylor",
    role: "nurse",
    persona: `You are an experienced pediatric ED nurse working with the team.
You execute orders, monitor vitals, and provide clinical observations.

Critical lines (say these when triggered):
- BP dropping: "Doctor, BP is crashing - [X] systolic!"
- Pre-intubation: "Getting ready to intubate. What induction agent? Pressor at bedside?"
- Fluid overload: "Crackles are getting worse with the fluids."
- SpO2 dropping: "SpO2 is [X]%. Should we increase support?"

For orders, ask for clarification if needed:
- "Epi" → "Epi drip or push dose? What concentration?"
- "Fluids" → "10 or 20 mL/kg? Run it fast or over 20?"
- "Labs" → "Which ones - CBC, BMP, troponin, BNP? All of them?"
- "Intubate" → "What induction agent - ketamine or propofol?"

Confirm when executing: "Starting [X] now. I'll let you know when it's in."`,
    clarificationPrompts: {
      epi: "Epi drip or push dose? What concentration?",
      fluids: "10 or 20 mL/kg bolus? Run it fast or over 20 minutes?",
      intubate: "What induction agent - ketamine or propofol? Pressor at bedside?",
      labs: "Which labs - CBC, BMP, troponin, BNP? All of them?",
      oxygen: "Nasal cannula, high flow, or mask?",
    },
  },
];

// ============================================================================
// Scoring Configuration
// ============================================================================

const scoringConfig = {
  passingThreshold: 4, // Need 4 out of 5 checklist items

  checklistItems: [
    {
      id: "recognized_cardiac",
      description: "Recognized cardiac etiology (ordered troponin/BNP/ECG)",
      points: 20,
    },
    {
      id: "avoided_fluid_overload",
      description: "Avoided fluid overload (≤40 mL/kg total)",
      points: 20,
    },
    {
      id: "called_picu_early",
      description: "Called PICU within 10 min of decompensation",
      points: 20,
    },
    {
      id: "safe_intubation",
      description: "Safe intubation (ketamine + pressor ready)",
      points: 20,
    },
    {
      id: "consulted_cardiology",
      description: "Consulted cardiology",
      points: 20,
    },
  ],

  bonuses: [
    { id: "early_ecg", description: "ECG ordered in first 3 minutes", points: 10, condition: "ecg_ordered_early" },
    { id: "early_troponin", description: "Troponin ordered in first 5 minutes", points: 10, condition: "troponin_ordered_early" },
    { id: "early_inotrope", description: "Started epi before intubation", points: 10, condition: "epi_before_intubation" },
    { id: "avoided_propofol", description: "Avoided propofol induction", points: 5, condition: "no_propofol" },
    { id: "ecmo_alert", description: "Called ECMO alert", points: 10, condition: "ecmo_called" },
  ],

  penalties: [
    { id: "fluid_overload", description: "Fluid overload (>40 mL/kg)", points: -15, condition: "fluids_over_40" },
    { id: "propofol_crash", description: "Propofol induction without pressor", points: -20, condition: "propofol_crash" },
    { id: "delayed_picu", description: "PICU called >15 min after decompensation", points: -10, condition: "picu_delayed" },
    { id: "no_cardiac_workup", description: "No troponin/BNP ordered", points: -15, condition: "no_cardiac_markers" },
  ],
};

// ============================================================================
// Full Scenario Definition
// ============================================================================

export const silentCrashScenario: ComplexScenarioDef = {
  id: "peds_myocarditis_silent_crash_v1",
  version: "1.0.0",
  scenarioType: "complex",
  title: "The Silent Crash",
  description: "Acute fulminant myocarditis in a 10-year-old with decompensating cardiogenic shock. Focus: recognition of cardiac etiology, avoiding fluid overload, safe airway management.",
  runtimeMinutes: 30,
  demographics: {
    ageYears: 10,
    weightKg: 32,
    sex: "male",
  },
  characters,
  phases,
  initialPhase: "scene_set",
  physiologyRules: MYOCARDITIS_PHYSIOLOGY_RULES,
  scoringConfig,
};

export default silentCrashScenario;
