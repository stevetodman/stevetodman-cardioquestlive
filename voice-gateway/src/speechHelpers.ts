import { CharacterId } from "./messageTypes";

export function respondForCharacter(character: CharacterId, doctorUtterance?: string, orderSummary?: string): string {
  const prompt = doctorUtterance?.trim();
  const fallback = orderSummary ? `Got it. ${orderSummary}` : "I'll take care of that.";
  switch (character) {
    case "parent":
      return (
        prompt ||
        "I'm worried—can you tell me what's happening and if there's anything I should do? I can share birth or family history if needed."
      );
    case "nurse":
      return prompt || (orderSummary ? orderSummary : "On it. I'll grab vitals now and update you.");
    case "tech":
      return prompt || (orderSummary ? orderSummary : "I'll get the EKG leads on and hand you a strip shortly.");
    case "imaging":
      return prompt || (orderSummary ? orderSummary : "I'll get the chest X-ray; give me a moment to process it.");
    case "consultant":
      return prompt || (orderSummary ? `Recent results: ${orderSummary}` : "Monitor closely and get an EKG; we can adjust after results.");
    case "patient":
    default:
      return prompt || fallback;
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
