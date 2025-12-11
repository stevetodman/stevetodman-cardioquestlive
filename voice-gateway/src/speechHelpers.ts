import { CharacterId } from "./messageTypes";

// Parse nurse requests and generate appropriate clinical responses
function parseNurseRequest(utterance: string): { response: string; action?: string } | null {
  const text = utterance.toLowerCase();

  // IV placement - DON'T handle here; let orderParser extract gauge/site and pass to IV order handler
  // This prevents duplicate/conflicting nurse responses (e.g., "20 gauge... twenty-two")

  // Vitals
  if (/vitals|blood pressure|bp|hr|pulse|oxygen|spo2|o2 sat/.test(text)) {
    return { response: "Getting vitals now. I'll have them up on the monitor in just a moment.", action: "Checking vitals" };
  }

  // Fluid bolus
  if (/bolus|fluids|saline|ns|lr|ringer/.test(text)) {
    const volume = text.match(/(\d+)\s*(ml|cc)/i)?.[1] || "20 mL/kg";
    return { response: `Starting ${volume} normal saline bolus now. I'll let you know when it's in.`, action: `NS bolus ${volume} started` };
  }

  // Oxygen
  if (/(oxygen|o2|nasal cannula|nc|mask|high flow|blow.?by)/.test(text)) {
    if (/blow.?by/.test(text)) {
      return { response: "Blow-by oxygen started.", action: "Blow-by O2 initiated" };
    }
    const liters = text.match(/(\d+)\s*l/i)?.[1] || "2";
    return { response: `${liters} liters by nasal cannula started.`, action: `O2 ${liters}L NC started` };
  }

  // Medications
  if (/adenosine/.test(text)) {
    return { response: "Adenosine drawn up and ready. I'll push on your count with the flush ready.", action: "Adenosine prepared" };
  }
  if (/epinephrine|epi/.test(text)) {
    return { response: "Epinephrine drawn up. Ready to give on your order.", action: "Epinephrine prepared" };
  }
  if (/(pge|prostaglandin|alprostadil)/.test(text)) {
    return { response: "PGE1 infusion starting now.", action: "PGE1 infusion started" };
  }
  if (/(tylenol|acetaminophen)/.test(text)) {
    return { response: "Tylenol given.", action: "Acetaminophen administered" };
  }
  if (/(motrin|ibuprofen)/.test(text)) {
    return { response: "Motrin given.", action: "Ibuprofen administered" };
  }
  if (/(morphine|fentanyl|pain)/.test(text)) {
    return { response: "Pain medication given. I'll reassess comfort in a few minutes.", action: "Analgesic administered" };
  }

  // Labs
  if (/(labs?|blood work|cbc|cmp|bmp|troponin|bnp|blood gas|abg|vbg)/.test(text)) {
    return { response: "Labs drawn and sent. Results should be back in about 15 minutes.", action: "Labs sent" };
  }

  // Monitor/telemetry
  if (/(monitor|tele|telemetry)/.test(text) && /(on|start|place|hook)/.test(text)) {
    return { response: "Patient on the monitor now.", action: "Telemetry initiated" };
  }

  // Suction
  if (/suction/.test(text)) {
    return { response: "Suctioning now.", action: "Airway suctioned" };
  }

  // NG tube
  if (/(ng|nasogastric|orogastric|og)\s*(tube)?/.test(text)) {
    return { response: "NG tube placed and secured. Confirmed placement.", action: "NG tube placed" };
  }

  // Foley
  if (/(foley|urinary catheter|urine catheter)/.test(text)) {
    return { response: "Foley catheter placed. Good urine output.", action: "Foley catheter placed" };
  }

  return null;
}

// Parse tech requests
function parseTechRequest(utterance: string): { response: string; action?: string } | null {
  const text = utterance.toLowerCase();

  if (/(ekg|ecg|12.?lead)/.test(text)) {
    return { response: "12-lead EKG coming up. Give me 30 seconds to get good contact.", action: "EKG ordered" };
  }
  if (/(echo|ultrasound|bedside)/.test(text)) {
    return { response: "Setting up for bedside echo now.", action: "Bedside echo ordered" };
  }
  if (/(xray|x-ray|cxr|chest)/.test(text) && /(film|ray|image)/.test(text)) {
    return { response: "Portable chest X-ray ordered. Radiology is on their way.", action: "CXR ordered" };
  }

  return null;
}

export function respondForCharacter(character: CharacterId, doctorUtterance?: string, orderSummary?: string): { text: string; action?: string } {
  const utterance = doctorUtterance?.trim() || "";
  const fallback = orderSummary ? `Got it. ${orderSummary}` : "I'll take care of that.";

  switch (character) {
    case "parent":
      return {
        text: utterance ||
          "I'm worried—can you tell me what's happening and if there's anything I should do? I can share birth or family history if needed."
      };
    case "nurse": {
      if (utterance) {
        const parsed = parseNurseRequest(utterance);
        if (parsed) return { text: parsed.response, action: parsed.action };
      }
      return { text: orderSummary ? orderSummary : "On it. I'll grab vitals now and update you." };
    }
    case "tech": {
      if (utterance) {
        const parsed = parseTechRequest(utterance);
        if (parsed) return { text: parsed.response, action: parsed.action };
      }
      return { text: orderSummary ? orderSummary : "I'll get the EKG leads on and hand you a strip shortly." };
    }
    case "imaging":
      return { text: orderSummary ? orderSummary : "I'll get the chest X-ray; give me a moment to process it." };
    case "consultant":
      return { text: orderSummary ? `Recent results: ${orderSummary}` : "Monitor closely and get an EKG; we can adjust after results." };
    case "patient":
    default:
      return { text: utterance || fallback };
  }
}

export function chooseCharacter(utterance?: string): CharacterId {
  if (!utterance) return "patient";
  const text = utterance.toLowerCase();
  if (/(vitals|blood pressure|bp|hr|pulse|oxygen|o2|spo2|iv|bolus|fluids|medicate|tylenol|motrin|pge)/.test(text)) {
    return "nurse";
  }
  if (/(ekg|ecg|monitor|strip|leads|imaging|xray|cxr|echo|ultrasound)/.test(text)) {
    return "tech";
  }
  if (/(consult|cardiology|icu|attending|what should we do|plan|recommend)/.test(text)) {
    return "consultant";
  }
  if (/(birth|pregnancy|family history|mom|dad|parent|guardian)/.test(text)) {
    return "parent";
  }
  return "patient";
}

export function isUnsafeUtterance(text: string): boolean {
  const lower = text.toLowerCase();
  const hasProfanity = /(fuck|shit|bitch|asshole|cunt)/.test(lower);
  const hasLongNumber = /\b\d{3}[-.\s]?\d{2,3}[-.\s]?\d{4}\b/.test(text);
  return hasProfanity || hasLongNumber;
}

export type OrderRequest =
  | { type: "vitals" }
  | { type: "ekg" }
  | { type: "labs" }
  | { type: "imaging" }
  | { type: "cardiac_exam" }
  | { type: "lung_exam" }
  | { type: "general_exam" };

/**
 * Parse utterance for order requests (vitals, exams, EKG, labs, imaging)
 * Returns the order type if a request is detected, null otherwise
 */
export function parseOrderRequest(utterance: string): OrderRequest | null {
  const text = utterance.toLowerCase();

  // Vitals request - "check vitals", "get vitals", "what are the vitals"
  if (/(check|get|give me|what are|show)\s*(the\s*)?(patient'?s?\s*)?(vital|vitals|vital signs)/.test(text) ||
      /^vitals?\b/.test(text)) {
    return { type: "vitals" };
  }

  // Cardiac exam - "listen to the heart", "auscultate the heart", "cardiac exam", "heart sounds"
  if (/(listen|auscultate)\s*(to\s*)?(the\s*)?(patient'?s?\s*)?(heart|chest|cardiac)/.test(text) ||
      /(cardiac|heart|cardiovascular)\s*(exam|examination|auscultation)/.test(text) ||
      /(check|assess|evaluate)\s*(the\s*)?(patient'?s?\s*)?(heart|cardiac)/.test(text) ||
      /^(cardiac|heart)\s*(exam)?$/.test(text)) {
    return { type: "cardiac_exam" };
  }

  // Lung exam - "listen to the lungs", "auscultate lungs", "lung exam", "breath sounds"
  if (/(listen|auscultate)\s*(to\s*)?(the\s*)?(patient'?s?\s*)?(lungs?|chest|pulmonary|respiratory)/.test(text) ||
      /(lung|pulmonary|respiratory)\s*(exam|examination|auscultation)/.test(text) ||
      /(check|assess|evaluate)\s*(the\s*)?(patient'?s?\s*)?(lungs?|breathing|breath sounds)/.test(text) ||
      /(breath|lung)\s*sounds/.test(text) ||
      /^(lung|pulmonary)\s*(exam)?$/.test(text)) {
    return { type: "lung_exam" };
  }

  // General exam - "physical exam", "examine the patient", "general exam"
  if (/(physical|general)\s*(exam|examination)/.test(text) ||
      /(do|perform|conduct)\s*(a\s*)?(physical|full|complete)\s*(exam|examination)/.test(text) ||
      /examine\s*(the\s*)?patient/.test(text) ||
      /^(physical|general)\s*(exam)?$/.test(text)) {
    return { type: "general_exam" };
  }

  // EKG request - "get an EKG", "12 lead", "ECG"
  if (/(get|order|do|run)\s*(a\s*)?(an\s*)?(12.?lead|ekg|ecg)/.test(text) ||
      /^(ekg|ecg|12.?lead)$/.test(text)) {
    return { type: "ekg" };
  }

  // Labs request - "order labs", "get labs", "blood work"
  if (/(get|order|draw|send)\s*(the\s*)?(labs?|blood\s*work|blood\s*tests?|cbc|cmp|bmp|troponin|bnp)/.test(text) ||
      /^labs?$/.test(text)) {
    return { type: "labs" };
  }

  // Imaging request - "get a chest x-ray", "order CXR", "imaging"
  if (/(get|order)\s*(a\s*)?(chest\s*)?(x-?ray|xray|cxr|imaging)/.test(text) ||
      /^(cxr|x-?ray|imaging)$/.test(text)) {
    return { type: "imaging" };
  }

  return null;
}
