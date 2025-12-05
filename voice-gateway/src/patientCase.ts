export type PatientScenarioId =
  | "exertional_chest_pain"
  | "syncope"
  | "palpitations_svt";

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
  }
}

export function createDefaultPatientCase(
  sessionId: string,
  scenarioId: PatientScenarioId = "exertional_chest_pain"
): PatientCase {
  return getPatientCaseForScenario(sessionId, scenarioId);
}
