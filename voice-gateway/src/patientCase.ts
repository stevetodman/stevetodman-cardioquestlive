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
    id: `case-${sessionId}`,
    age: 15,
    sex: "female",
    name: "Sam",
    chiefComplaint: "Exertional chest pain and palpitations",
    onset: "Noticed over the past 2 months, worse during basketball practice",
    associatedSymptoms: ["lightheadedness with sprints", "brief shortness of breath", "occasional skipped beats"],
    relevantPMH: ["No known heart problems before", "Otherwise healthy teenager"],
    medications: ["Daily multivitamin"],
    allergies: ["Penicillin (rash)"],
    familyHistory: ["Dad fainted once in college sports", "Paternal uncle died suddenly at 32 (unknown cause)"],
    socialHistory: ["Plays varsity basketball", "Denies vaping/drugs", "Occasional caffeine energy drinks"],
    baselinePersonality: "Athletic but anxious about missing the season, cooperative and honest",
    redFlags: ["Chest pain with exertion", "Presyncope during intense exercise", "Family history of sudden cardiac death"],
  };
}
