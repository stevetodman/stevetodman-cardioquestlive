export type PatientScenarioId =
  | "exertional_chest_pain"
  | "syncope"
  | "palpitations_svt"
  | "myocarditis"
  | "exertional_syncope_hcm"
  | "ductal_shock"
  | "cyanotic_spell"
  | "kawasaki"
  | "coarctation_shock"
  | "arrhythmogenic_syncope"
  | "teen_svt_complex_v1"
  | "peds_myocarditis_silent_crash_v1";

export type PatientCase = {
  id: string;
  age: number;
  sex: "male" | "female" | "other";
  name: string;
  chiefComplaint: string;
  onset: string;
  associatedSymptoms: string[];
  relevantPMH: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string[];
  socialHistory: string[];
  baselinePersonality: string;
  redFlags: string[];
  scenarioId: PatientScenarioId;
};

export function getPatientCaseForScenario(
  sessionId: string,
  scenarioId: PatientScenarioId
): PatientCase {
  switch (scenarioId) {
    case "syncope":
      return {
        id: sessionId,
        scenarioId,
        age: 14,
        sex: "female",
        name: "Jordan",
        chiefComplaint: "passing out during exercise",
        onset: "over the past month",
        associatedSymptoms: ["lightheadedness before passing out", "brief tunnel vision"],
        relevantPMH: ["otherwise healthy", "no known heart disease"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: [
          "no known sudden deaths in young relatives",
          "an uncle fainted once playing basketball but recovered",
        ],
        socialHistory: [
          "middle school student, plays basketball",
          "no tobacco, vaping, alcohol, or drugs",
        ],
        baselinePersonality: "nervous about fainting again but cooperative",
        redFlags: ["syncope with exertion", "preceded by lightheadedness"],
      };
    case "palpitations_svt":
      return {
        id: sessionId,
        scenarioId,
        age: 16,
        sex: "male",
        name: "Alex",
        chiefComplaint: "sudden racing heart episodes",
        onset: "on and off for the past year",
        associatedSymptoms: ["mild shortness of breath during episodes", "sometimes chest fluttering"],
        relevantPMH: ["otherwise healthy"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: [
          "mother has 'fast heartbeats' treated with medication",
          "no sudden deaths in family",
        ],
        socialHistory: [
          "high school student, plays casual soccer and video games",
          "no tobacco, vaping, alcohol, or drugs",
        ],
        baselinePersonality: "casual but a bit worried when episodes happen",
        redFlags: ["recurrent palpitations", "lightheadedness during episodes"],
      };
    case "kawasaki":
      return {
        id: sessionId,
        scenarioId,
        age: 4,
        sex: "male",
        name: "Mason",
        chiefComplaint: "5 days of fever and rash",
        onset: "fever for 5 days, rash/red eyes for 3 days",
        associatedSymptoms: ["cracked lips", "strawberry tongue", "swollen hands/feet", "cervical lymph node"],
        relevantPMH: ["previously healthy"],
        medications: ["acetaminophen at home"],
        allergies: ["no known drug allergies"],
        familyHistory: ["no known coronary disease in young relatives"],
        socialHistory: ["preschooler, recent viral contacts at daycare"],
        baselinePersonality: "fussy and tired, uncomfortable with fever",
        redFlags: ["persistent fever >5 days", "mucocutaneous findings"],
      };
    case "coarctation_shock":
      return {
        id: sessionId,
        scenarioId,
        age: 2,
        sex: "female",
        name: "Ava",
        chiefComplaint: "Poor feeding and lethargy",
        onset: "worsening over 12 hours",
        associatedSymptoms: ["tachypnea", "cool legs", "decreased urine"],
        relevantPMH: ["full-term infant, no prior issues noted"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: ["no congenital heart disease known"],
        socialHistory: ["lives with parents, up to date on vaccines"],
        baselinePersonality: "sleepy, irritable with handling",
        redFlags: ["upper/lower pulse difference", "shock picture in infant"],
      };
    case "arrhythmogenic_syncope":
      return {
        id: sessionId,
        scenarioId,
        age: 15,
        sex: "male",
        name: "Diego",
        chiefComplaint: "Collapse during practice",
        onset: "episode today, brief loss of consciousness",
        associatedSymptoms: ["palpitations before collapse", "rapid recovery"],
        relevantPMH: ["no known heart disease"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: ["cousin died suddenly at 19"],
        socialHistory: ["plays soccer, no substances"],
        baselinePersonality: "anxious after the episode, otherwise cooperative",
        redFlags: ["syncope with exertion", "family sudden death"],
      };
    case "exertional_chest_pain":
    default:
      return {
        id: sessionId,
        scenarioId: "exertional_chest_pain",
        age: 15,
        sex: "female",
        name: "Taylor",
        chiefComplaint: "chest pain and heart racing with exercise",
        onset: "over the past 2–3 months",
        associatedSymptoms: ["shortness of breath with running", "lightheadedness once during PE"],
        relevantPMH: ["otherwise healthy", "no known heart disease"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: [
          "no known sudden deaths in young relatives",
          "grandfather had a heart attack in his 60s",
        ],
        socialHistory: [
          "high school student, plays soccer",
          "no tobacco, vaping, alcohol, or drugs",
        ],
        baselinePersonality: "a bit anxious but generally cooperative and open",
        redFlags: ["chest pain with exertion", "lightheadedness during exercise"],
      };
    case "myocarditis":
      return {
        id: sessionId,
        scenarioId,
        age: 12,
        sex: "male",
        name: "Evan",
        chiefComplaint: "fever then chest discomfort and fatigue",
        onset: "over the past 3 days after viral symptoms",
        associatedSymptoms: ["fever", "myalgias", "fatigue", "mild shortness of breath"],
        relevantPMH: ["previously healthy"],
        medications: ["ibuprofen as needed"],
        allergies: ["no known drug allergies"],
        familyHistory: ["no sudden deaths", "no cardiomyopathy known"],
        socialHistory: ["middle school student; recent viral contact at home"],
        baselinePersonality: "tired and subdued; answers briefly",
        redFlags: ["viral prodrome with chest pain", "tachycardia out of proportion to fever"],
      };
    case "exertional_syncope_hcm":
      return {
        id: sessionId,
        scenarioId,
        age: 15,
        sex: "female",
        name: "Leah",
        chiefComplaint: "near-syncope during intense practice",
        onset: "episodes over 2 weeks during sprints",
        associatedSymptoms: ["palpitations", "brief chest tightness", "dizziness"],
        relevantPMH: ["otherwise healthy"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: ["uncle died suddenly at 32 playing soccer"],
        socialHistory: ["competitive track athlete; no substances"],
        baselinePersonality: "focused but worried about missing season",
        redFlags: ["exertional presyncope", "family history sudden death"],
      };
    case "ductal_shock":
      return {
        id: sessionId,
        scenarioId,
        age: 6,
        sex: "male",
        name: "Noah",
        chiefComplaint: "poor feeding and lethargy",
        onset: "worsening over 12 hours",
        associatedSymptoms: ["cool extremities", "tachypnea", "decreased urine output"],
        relevantPMH: ["term infant, no surgeries"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: ["noncontributory"],
        socialHistory: ["lives with parents; up to date on vaccines"],
        baselinePersonality: "sleepy, irritable when stimulated",
        redFlags: ["shock in infant", "possible duct-dependent lesion"],
      };
    case "cyanotic_spell":
      return {
        id: sessionId,
        scenarioId,
        age: 3,
        sex: "female",
        name: "Maya",
        chiefComplaint: "turning blue and squatting after playing",
        onset: "episodes over the past week",
        associatedSymptoms: ["breath-holding-looking episodes", "improves with squatting"],
        relevantPMH: ["known congenital heart disease, poor follow-up"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: ["noncontributory"],
        socialHistory: ["toddlers at daycare; otherwise active"],
        baselinePersonality: "active toddler, frightened during spells",
        redFlags: ["cyanosis with exertion/crying", "possible tet spell"],
      };
    case "teen_svt_complex_v1":
      return {
        id: sessionId,
        scenarioId,
        age: 14,
        sex: "female",
        name: "Alex Chen",
        chiefComplaint: "episodes of rapid palpitations",
        onset: "on and off for 6 months, currently in an episode",
        associatedSymptoms: ["chest fluttering", "mild dizziness during episodes", "anxiety"],
        relevantPMH: ["otherwise healthy", "one prior ER visit for palpitations"],
        medications: [],
        allergies: ["no known drug allergies"],
        familyHistory: [
          "mother had WPW ablated in her 20s",
          "no sudden deaths in family",
        ],
        socialHistory: [
          "8th grader, plays volleyball",
          "no tobacco, vaping, alcohol, or drugs",
        ],
        baselinePersonality: "anxious during episodes but cooperative; mom is present and concerned",
        redFlags: ["recurrent SVT", "family history of WPW", "currently symptomatic"],
      };
  }
}

export function createDefaultPatientCase(
  sessionId: string,
  scenarioId: PatientScenarioId = "exertional_chest_pain"
): PatientCase {
  return getPatientCaseForScenario(sessionId, scenarioId);
}
