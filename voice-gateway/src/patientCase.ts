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
};

export function createDefaultPatientCase(sessionId: string): PatientCase {
  return {
    id: sessionId,
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
