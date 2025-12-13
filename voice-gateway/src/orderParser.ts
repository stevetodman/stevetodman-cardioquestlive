/**
 * Order Parser for Free-Text Medical Orders
 *
 * Parses natural language orders from learners into structured commands.
 * When orders are ambiguous or incomplete, returns clarification questions
 * for the nurse to ask.
 */

// ============================================================================
// Order Types
// ============================================================================

export type OrderType =
  // Interventions
  | "iv_access"
  | "fluids"
  | "oxygen"
  | "intubation"
  | "hfnc"
  // SVT-specific interventions
  | "vagal_maneuver"
  | "adenosine"
  | "cardioversion"
  | "sedation"
  // Medications
  | "epi_drip"
  | "epi_push"
  | "milrinone"
  | "dobutamine"
  | "other_med"
  // Diagnostics
  | "labs"
  | "ecg"
  | "echo"
  | "cxr"
  | "abg"
  // Consults
  | "consult_picu"
  | "consult_cardiology"
  | "consult_ecmo"
  // Monitoring
  | "monitor"
  | "defib_pads"
  // Other
  | "unknown";

export type ParsedOrder = {
  type: OrderType;
  confidence: "high" | "medium" | "low";
  params: Record<string, string | number | boolean | undefined>;
  needsClarification: boolean;
  clarificationQuestion?: string;
  rawText: string;
};

// ============================================================================
// Clarification Questions (what the nurse asks when orders are incomplete)
// ============================================================================

const CLARIFICATION_QUESTIONS: Record<string, string> = {
  fluids_volume: "How much - 10 or 20 mL/kg? Want me to push it or run it over 20 minutes?",
  fluids_type: "Normal saline or lactated Ringer's?",
  epi_type: "Epi drip or push-dose? What rate if it's a drip?",
  epi_dose: "What dose - 0.05, 0.1, or 0.2 mcg/kg/min?",
  intubation_induction: "What induction agent - ketamine or propofol? Should I draw up push-dose epi first?",
  intubation_settings: "What PEEP and FiO2 do you want to start at?",
  labs_which: "Which labs - CBC, BMP, troponin, BNP, lactate? All of them?",
  oxygen_delivery: "Nasal cannula, mask, or high-flow?",
  oxygen_flow: "What flow rate - how many liters?",
  iv_location: "Which site - hand, AC, or foot?",
  milrinone_dose: "What loading dose and maintenance rate?",
  // SVT-specific clarifications
  vagal_type: "Modified Valsalva, ice to face, or bearing down?",
  adenosine_dose: "What dose - 0.1 or 0.2 mg/kg? Rapid push with flush?",
  cardioversion_settings: "What joules? And what sedation first?",
  sedation_agent: "Midazolam, ketamine, or propofol for sedation?",
};

// ============================================================================
// Pattern Matching
// ============================================================================

type PatternMatcher = {
  patterns: RegExp[];
  type: OrderType;
  extractor?: (text: string, match: RegExpMatchArray) => Partial<ParsedOrder["params"]>;
  needsClarification?: (params: Record<string, unknown>) => string | null;
  preCheck?: (text: string) => boolean; // Must return true for matcher to be considered
};

const MATCHERS: PatternMatcher[] = [
  // ========== FLUIDS ==========
  {
    patterns: [
      /(?:give|start|run|push|bolus)\s*(?:(?:a|some)\s+)?(?:fluid(?:s)?|saline|ns|lr|normal saline|lactated ringer)/i,
      /(?:fluid|saline|ns|lr)\s*(?:bolus|push)/i,
      /(\d+)\s*(?:ml|cc)(?:\/kg)?\s*(?:of\s+)?(?:fluid|saline|ns|bolus)/i,
      /(\d+)\s*(?:per|\/)\s*(?:kg|kilo)/i,
    ],
    type: "fluids",
    extractor: (text) => {
      const volumeMatch = text.match(/(\d+)\s*(?:ml|cc|per|\/)/i);
      const mlKg = volumeMatch ? parseInt(volumeMatch[1]) : undefined;
      const isLR = /lr|lactated|ringer/i.test(text);
      const isPush = /push|fast|rapid|wide open/i.test(text);
      return {
        mlKg,
        fluidType: isLR ? "LR" : "NS",
        rate: isPush ? "push" : "over_20_min",
      };
    },
    needsClarification: (params) => {
      if (!params.mlKg) return CLARIFICATION_QUESTIONS.fluids_volume;
      return null;
    },
  },

  // ========== SVT-SPECIFIC INTERVENTIONS ==========
  {
    patterns: [
      /vagal\s*(?:maneuver)?/i,
      /valsalva/i,
      /(?:try|do|attempt)\s*(?:a\s+)?vagal/i,
      /bear(?:ing)?\s*down/i,
      /ice\s*(?:to\s*)?(?:the\s*)?face/i,
      /modified\s*valsalva/i,
    ],
    type: "vagal_maneuver",
    extractor: (text) => {
      const isValsalva = /valsalva|bear(?:ing)?\s*down/i.test(text);
      const isIce = /ice/i.test(text);
      const isModified = /modified/i.test(text);
      return {
        method: isIce ? "ice_to_face" : isModified ? "modified_valsalva" : isValsalva ? "valsalva" : undefined,
      };
    },
  },
  {
    patterns: [
      /(?:give|push|administer)\s*(?:some\s+)?adenosine/i,
      /adenosine\s*(?:(\d+(?:\.\d+)?)\s*(?:mg)?)?/i,
      /(?:first|second)\s*(?:dose\s+)?(?:of\s+)?adenosine/i,
    ],
    type: "adenosine",
    extractor: (text) => {
      const doseMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mg)?/i);
      const doseMg = doseMatch ? parseFloat(doseMatch[1]) : undefined;
      const isSecond = /second|0\.2|point\s*two/i.test(text);
      const rapidPush = /rapid|fast|quick/i.test(text);
      const flushMentioned = /flush/i.test(text);
      return {
        doseMg,
        isSecondDose: isSecond,
        rapidPush,
        flushMentioned,
      };
    },
    needsClarification: (params) => {
      // If no dose specified, suggest first dose
      if (!params.doseMg && !params.isSecondDose) return null; // Will use default 0.1 mg/kg
      return null;
    },
  },
  {
    patterns: [
      /cardiovert/i,
      /(?:sync(?:hronized)?)\s*(?:shock|cardioversion)/i,
      /electrical\s*cardioversion/i,
      /shock\s*(?:her|him|the\s*patient|them)/i,
    ],
    type: "cardioversion",
    extractor: (text) => {
      const joulesMatch = text.match(/(\d+)\s*(?:j(?:oules)?)/i);
      const joules = joulesMatch ? parseInt(joulesMatch[1]) : undefined;
      const isSynced = /sync/i.test(text);
      return {
        joules,
        synchronized: isSynced !== false, // Default to synchronized for SVT
      };
    },
    needsClarification: (params) => {
      if (!params.joules) return CLARIFICATION_QUESTIONS.cardioversion_settings;
      return null;
    },
  },
  {
    patterns: [
      /(?:give|administer)\s*(?:some\s+)?sedation/i,
      /sedate\s*(?:the\s+)?(?:patient|her|him)/i,
      /(?:midazolam|versed|ketamine|propofol)\s*(?:for\s+)?(?:sedation|cardioversion)?/i,
      /(?:give|administer)\s*(?:midazolam|versed|ketamine|propofol)/i,
      /procedural\s*sedation/i,
    ],
    // Note: Don't match if "intubat" is present - let intubation handler take those
    preCheck: (text: string) => !/intubat/i.test(text),
    type: "sedation",
    extractor: (text) => {
      const isMidazolam = /midazolam|versed/i.test(text);
      const isKetamine = /ketamine/i.test(text);
      const isPropofol = /propofol/i.test(text);
      return {
        agent: isMidazolam ? "midazolam" : isKetamine ? "ketamine" : isPropofol ? "propofol" : undefined,
      };
    },
    needsClarification: (params) => {
      if (!params.agent) return CLARIFICATION_QUESTIONS.sedation_agent;
      return null;
    },
  },

  // ========== EPINEPHRINE ==========
  {
    patterns: [
      /(?:start|give|hang|run)\s*(?:an?\s+)?(?:epi(?:nephrine)?|adrenaline)\s*(?:drip|infusion|gtt)/i,
      /epi(?:nephrine)?\s*(?:at\s+)?(\d+(?:\.\d+)?)\s*(?:mcg|mic)/i,
      /(?:epi(?:nephrine)?)\s*drip/i,
    ],
    type: "epi_drip",
    extractor: (text) => {
      const doseMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mcg|mic)/i);
      const dose = doseMatch ? parseFloat(doseMatch[1]) : undefined;
      return { doseMcgKgMin: dose };
    },
    needsClarification: (params) => {
      if (!params.doseMcgKgMin) return CLARIFICATION_QUESTIONS.epi_dose;
      return null;
    },
  },
  {
    patterns: [
      /push(?:\s*dose)?\s*epi/i,
      /epi(?:nephrine)?\s*push/i,
      /(?:give|draw up)\s*(?:push(?:\s*dose)?|bolus)\s*epi/i,
    ],
    type: "epi_push",
    extractor: () => ({ isPushDose: true }),
  },

  // ========== MILRINONE ==========
  {
    patterns: [
      /(?:start|give|hang|run)\s*(?:a\s+)?milrinone/i,
      /milrinone\s*(?:drip|infusion|gtt)/i,
    ],
    type: "milrinone",
    extractor: (text) => {
      const loadMatch = text.match(/(\d+)\s*(?:mcg|mic)(?:\/kg)?\s*load/i);
      const maintMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mcg|mic)(?:\/kg)?(?:\/|\s*per\s*)min/i);
      return {
        loadingDoseMcgKg: loadMatch ? parseInt(loadMatch[1]) : undefined,
        maintenanceMcgKgMin: maintMatch ? parseFloat(maintMatch[1]) : undefined,
      };
    },
    needsClarification: (params) => {
      if (!params.maintenanceMcgKgMin) return CLARIFICATION_QUESTIONS.milrinone_dose;
      return null;
    },
  },

  // ========== INTUBATION ==========
  {
    patterns: [
      /(?:let'?s\s+)?intubat(?:e|ion)/i,
      /(?:need|want)\s*(?:to\s+)?(?:secure|protect)\s*(?:the\s+)?airway/i,
      /tube\s*(?:this|the)\s*(?:kid|patient)/i,
      /rsi/i,
    ],
    type: "intubation",
    extractor: (text) => {
      const ketamine = /ketamine/i.test(text);
      const propofol = /propofol/i.test(text);
      const peepMatch = text.match(/peep\s*(?:of\s+)?(\d+)/i);
      const fio2Match = text.match(/fio2?\s*(?:of\s+)?(\d+)/i);
      const pressorReady = /pressor|epi|push.?dose/i.test(text);
      return {
        inductionAgent: ketamine ? "ketamine" : propofol ? "propofol" : undefined,
        peep: peepMatch ? parseInt(peepMatch[1]) : undefined,
        fio2: fio2Match ? parseInt(fio2Match[1]) : undefined,
        pressorReady,
      };
    },
    needsClarification: (params) => {
      if (!params.inductionAgent) return CLARIFICATION_QUESTIONS.intubation_induction;
      return null;
    },
  },

  // ========== HIGH FLOW NASAL CANNULA ==========
  {
    patterns: [
      /high\s*flow/i,
      /hfnc/i,
      /(?:start|put\s*(?:on|them\s+on))\s*high\s*flow/i,
    ],
    type: "hfnc",
    extractor: (text) => {
      const flowMatch = text.match(/(\d+)\s*(?:l|liters?)/i);
      const fio2Match = text.match(/(\d+)\s*%/i);
      return {
        flowLpm: flowMatch ? parseInt(flowMatch[1]) : undefined,
        fio2: fio2Match ? parseInt(fio2Match[1]) : undefined,
      };
    },
  },

  // ========== OXYGEN ==========
  {
    patterns: [
      /(?:start|put\s*(?:on|them\s+on)|give)\s*(?:some\s+)?(?:o2|oxygen)/i,
      /nasal\s*cannula/i,
      /(?:non-?rebreather|nrb)/i,
      /(\d+)\s*(?:l|liters?)\s*(?:by|via|of|on)?\s*(?:nc|nasal|mask|o2|oxygen)?/i,
    ],
    type: "oxygen",
    extractor: (text) => {
      const flowMatch = text.match(/(\d+)\s*(?:l|liters?)/i);
      const isNRB = /non-?rebreather|nrb|15\s*l/i.test(text);
      const isNC = /nc|nasal\s*cannula/i.test(text);
      return {
        flowLpm: flowMatch ? parseInt(flowMatch[1]) : undefined,
        delivery: isNRB ? "non_rebreather" : isNC ? "nasal_cannula" : "mask",
      };
    },
    needsClarification: (params) => {
      if (!params.flowLpm && !params.delivery) return CLARIFICATION_QUESTIONS.oxygen_delivery;
      return null;
    },
  },

  // ========== IV ACCESS ==========
  {
    patterns: [
      /(?:get|place|start|put\s*in)\s*(?:an?\s+)?(?:iv|line|access)/i,
      /(?:iv|peripheral)\s*access/i,
      /(\d+)\s*(?:gauge|g)\s*(?:iv|line)/i,
    ],
    type: "iv_access",
    extractor: (text) => {
      const gaugeMatch = text.match(/(\d+)\s*(?:gauge|g)/i);
      const hand = /hand/i.test(text);
      const ac = /ac|antecub/i.test(text);
      const foot = /foot/i.test(text);
      return {
        gauge: gaugeMatch ? parseInt(gaugeMatch[1]) : 22,
        location: hand ? "hand" : ac ? "ac" : foot ? "foot" : undefined,
      };
    },
  },

  // ========== LABS ==========
  {
    patterns: [
      /(?:get|order|draw|send)\s*(?:some\s+)?labs?/i,
      /(?:cbc|bmp|cmp|troponin|bnp|lactate)/i,
      /blood\s*(?:work|tests?)/i,
    ],
    type: "labs",
    extractor: (text) => {
      const cbc = /cbc/i.test(text);
      const bmp = /bmp|cmp|metabolic/i.test(text);
      const troponin = /troponin|trop/i.test(text);
      const bnp = /bnp/i.test(text);
      const lactate = /lactate/i.test(text);
      const all = /all|full|complete/i.test(text) || (!cbc && !bmp && !troponin && !bnp && !lactate);
      return {
        cbc: all || cbc,
        bmp: all || bmp,
        troponin: all || troponin,
        bnp: all || bnp,
        lactate: all || lactate,
      };
    },
    needsClarification: (params) => {
      // Only ask if nothing specific was mentioned and no "all" was said
      const hasSpecific = params.cbc || params.bmp || params.troponin || params.bnp || params.lactate;
      if (!hasSpecific) return CLARIFICATION_QUESTIONS.labs_which;
      return null;
    },
  },

  // ========== ECG/EKG ==========
  {
    patterns: [
      /(?:get|order|do|run)\s*(?:an?\s+)?(?:ecg|ekg|12.?lead)/i,
      /12.?lead/i,
      /^(?:ecg|ekg)$/i,
    ],
    type: "ecg",
  },

  // ========== ECHO ==========
  {
    patterns: [
      /(?:get|order|do)\s*(?:an?\s+)?(?:echo|echocardiogram)/i,
      /bedside\s*(?:echo|cardiac\s*ultrasound)/i,
    ],
    type: "echo",
  },

  // ========== CHEST X-RAY ==========
  {
    patterns: [
      /(?:get|order)\s*(?:a\s+)?(?:chest\s*)?(?:x-?ray|cxr)/i,
      /portable\s*(?:chest|cxr)/i,
    ],
    type: "cxr",
  },

  // ========== ABG ==========
  {
    patterns: [
      /(?:get|draw|send)\s*(?:an?\s+)?(?:abg|arterial\s*blood\s*gas)/i,
      /blood\s*gas/i,
    ],
    type: "abg",
  },

  // ========== CONSULTS ==========
  {
    patterns: [
      /(?:call|page|get|consult)\s*(?:the\s+)?picu/i,
      /picu\s*(?:consult|involved)/i,
    ],
    type: "consult_picu",
  },
  {
    patterns: [
      /(?:call|page|get|consult)\s*(?:the\s+)?(?:cardiology|cards|cardiologist)/i,
      /(?:cardiology|cards)\s*consult/i,
    ],
    type: "consult_cardiology",
  },
  {
    patterns: [
      /(?:call|page|get|consult)\s*(?:for\s+)?ecmo/i,
      /ecmo\s*(?:team|consult|evaluation)/i,
      /need\s*ecmo/i,
    ],
    type: "consult_ecmo",
  },

  // ========== MONITORING ==========
  {
    patterns: [
      /(?:put|get)\s*(?:them\s+)?on\s*(?:the\s+)?monitor/i,
      /(?:start|get)\s*telemetry/i,
      /cardiac\s*monitor/i,
    ],
    type: "monitor",
  },
  {
    patterns: [
      /(?:put\s*on|place|get)\s*(?:the\s+)?(?:defib|defibrillator)\s*pads/i,
      /pads\s*on/i,
    ],
    type: "defib_pads",
  },
];

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse free-text order into structured format
 *
 * @param utterance - The learner's spoken order
 * @returns ParsedOrder with type, params, and clarification if needed
 */
export function parseOrder(utterance: string): ParsedOrder {
  const text = utterance.trim().toLowerCase();

  for (const matcher of MATCHERS) {
    // Skip this matcher if preCheck fails
    if (matcher.preCheck && !matcher.preCheck(text)) {
      continue;
    }

    for (const pattern of matcher.patterns) {
      const match = text.match(pattern);
      if (match) {
        const params = matcher.extractor ? matcher.extractor(text, match) : {};
        const clarificationQuestion = matcher.needsClarification
          ? matcher.needsClarification(params)
          : null;

        return {
          type: matcher.type,
          confidence: clarificationQuestion ? "medium" : "high",
          params,
          needsClarification: !!clarificationQuestion,
          clarificationQuestion: clarificationQuestion ?? undefined,
          rawText: utterance,
        };
      }
    }
  }

  // No match found
  return {
    type: "unknown",
    confidence: "low",
    params: {},
    needsClarification: false,
    rawText: utterance,
  };
}

/**
 * Parse multiple orders from a single utterance
 * (e.g., "Get labs and an EKG")
 */
export function parseMultipleOrders(utterance: string): ParsedOrder[] {
  const orders: ParsedOrder[] = [];

  // Split on common conjunctions
  const parts = utterance.split(/\s+(?:and|,|also|then|plus)\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 2) {
      const order = parseOrder(trimmed);
      if (order.type !== "unknown") {
        orders.push(order);
      }
    }
  }

  // If no orders found from split, try the whole utterance
  if (orders.length === 0) {
    const order = parseOrder(utterance);
    if (order.type !== "unknown") {
      orders.push(order);
    }
  }

  return orders;
}

/**
 * Generate nurse response for a parsed order
 *
 * @param order - The parsed order
 * @returns The nurse's response (either clarification or confirmation)
 */
export function getNurseResponse(order: ParsedOrder): string {
  if (order.needsClarification && order.clarificationQuestion) {
    return order.clarificationQuestion;
  }

  // Confirmation responses by order type
  switch (order.type) {
    case "fluids": {
      const volume = order.params.mlKg;
      const rate = order.params.rate === "push" ? "pushing it now" : "running over 20";
      return `Got it, ${volume} mL/kg of ${order.params.fluidType || "saline"}, ${rate}.`;
    }
    case "epi_drip":
      return `Starting epi drip at ${order.params.doseMcgKgMin || "0.1"} mcg/kg/min. I'll let you know when it's running.`;
    case "epi_push":
      return "Push-dose epi drawn up and ready. On your count.";
    case "milrinone":
      return "Milrinone infusion starting. This one takes a few minutes to load.";
    case "intubation":
      return order.params.inductionAgent
        ? `${order.params.inductionAgent} ready. ${order.params.pressorReady ? "Epi at bedside." : "Want me to draw up push-dose epi?"}`
        : "Getting intubation set up.";
    case "hfnc":
      return "High-flow started. I'll dial in the settings.";
    case "oxygen":
      return `Oxygen on at ${order.params.flowLpm || "2"} liters.`;
    case "iv_access":
      return "Working on IV access now.";
    case "labs":
      return "Labs drawn and sent. Results in about 10-15 minutes.";
    case "ecg":
      return "Getting the 12-lead now. Give me a minute.";
    case "echo":
      return "Paging the echo tech. They should be here in 15-20 minutes.";
    case "cxr":
      return "Portable chest x-ray ordered. They're on their way.";
    case "abg":
      return "Drawing the ABG now.";
    case "consult_picu":
      return "Paging PICU now. I'll let you know when they call back.";
    case "consult_cardiology":
      return "Got it, paging cards. They usually call back pretty quick.";
    case "consult_ecmo":
      return "ECMO team paged. That gets their attention.";
    case "monitor":
      return "Patient's on the monitor. I'll set the alarm limits.";
    case "defib_pads":
      return "Defib pads going on now.";
    // SVT-specific responses
    case "vagal_maneuver": {
      const method = order.params.method;
      if (method === "ice_to_face") return "I'll get the ice pack ready. Want me to hold it to her face?";
      if (method === "modified_valsalva") return "Got it - I'll coach her through the modified Valsalva.";
      if (method === "valsalva") return "Okay, trying vagal maneuver now. Alex, I need you to bear down like you're going to the bathroom.";
      return "Which vagal maneuver - modified Valsalva, ice to face, or bearing down?";
    }
    case "adenosine": {
      const dose = order.params.doseMg;
      const isSecond = order.params.isSecondDose;
      if (dose) return `Adenosine ${dose} mg ready. Rapid push with 5 mL flush on your count.`;
      if (isSecond) return "Second dose adenosine - 0.2 mg/kg ready. That's 10 mg. Rapid push with flush?";
      return "Adenosine 0.1 mg/kg ready - that's 5 mg. Rapid push with 5 mL flush?";
    }
    case "cardioversion": {
      const joules = order.params.joules;
      if (joules) return `Setting up for synchronized cardioversion at ${joules} J. Is she sedated?`;
      return "What joules do you want? And what sedation first?";
    }
    case "sedation": {
      const agent = order.params.agent;
      if (agent === "midazolam") return "Midazolam 0.1 mg/kg IV ready - that's 5 mg. Want me to give it now?";
      if (agent === "ketamine") return "Ketamine 1 mg/kg IV ready - that's 50 mg. She'll be out shortly after.";
      if (agent === "propofol") return "Propofol ready. Going slow to avoid hypotension.";
      return "What sedation agent - midazolam, ketamine, or propofol?";
    }
    default:
      return "I'll take care of that.";
  }
}

/**
 * Check if an order response answers a pending clarification
 */
export function parseClarificationResponse(
  response: string,
  pendingOrderType: OrderType
): Partial<ParsedOrder["params"]> | null {
  const text = response.toLowerCase();

  switch (pendingOrderType) {
    case "fluids": {
      // Check for volume
      const volumeMatch = text.match(/(\d+)\s*(?:ml|cc|per|\/)/i);
      if (volumeMatch) {
        return { mlKg: parseInt(volumeMatch[1]) };
      }
      // Check for rate
      if (/push|fast|rapid|wide/i.test(text)) return { rate: "push" };
      if (/slow|over|twenty|20/i.test(text)) return { rate: "over_20_min" };
      break;
    }

    case "epi_drip": {
      // Check for dose
      const epiMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mcg|mic|point)/i);
      if (epiMatch) return { doseMcgKgMin: parseFloat(epiMatch[1]) };
      if (/0?\s*\.?\s*0?\s*5|point\s*o?\s*five/i.test(text)) return { doseMcgKgMin: 0.05 };
      if (/0?\s*\.?\s*1|point\s*one/i.test(text)) return { doseMcgKgMin: 0.1 };
      if (/0?\s*\.?\s*2|point\s*two/i.test(text)) return { doseMcgKgMin: 0.2 };
      break;
    }

    case "intubation":
      if (/ketamine/i.test(text)) return { inductionAgent: "ketamine" };
      if (/propofol/i.test(text)) return { inductionAgent: "propofol" };
      if (/etomidate/i.test(text)) return { inductionAgent: "etomidate" };
      break;

    case "oxygen": {
      const flowMatch = text.match(/(\d+)\s*(?:l|liters?)/i);
      if (flowMatch) return { flowLpm: parseInt(flowMatch[1]) };
      if (/nc|nasal/i.test(text)) return { delivery: "nasal_cannula" };
      if (/nrb|non-?rebreather|mask/i.test(text)) return { delivery: "non_rebreather" };
      break;
    }
  }

  return null;
}

// ============================================================================
// Order Validation for Complex Scenarios
// ============================================================================

export type OrderValidation = {
  isValid: boolean;
  warnings: string[];
  teachingPoints?: string[];
};

/**
 * Validate an order in context of myocarditis scenario
 */
export function validateMyocarditisOrder(
  order: ParsedOrder,
  context: {
    shockStage: number;
    totalFluidsMlKg: number;
    hasEpiRunning: boolean;
    hasAirway: boolean;
  }
): OrderValidation {
  const warnings: string[] = [];
  const teachingPoints: string[] = [];

  // Fluid overload check
  if (order.type === "fluids") {
    const newTotal = context.totalFluidsMlKg + (order.params.mlKg as number || 20);
    if (newTotal > 40) {
      warnings.push("Total fluids will exceed 40 mL/kg - high risk of pulmonary edema in cardiogenic shock");
      teachingPoints.push("In cardiogenic shock, fluids can worsen pulmonary edema. Consider inotropes instead.");
    } else if (newTotal > 20 && context.shockStage >= 2) {
      warnings.push("Consider cautious fluid administration - patient is in cardiogenic shock");
    }
  }

  // Intubation safety
  if (order.type === "intubation") {
    if (order.params.inductionAgent === "propofol" && !context.hasEpiRunning) {
      warnings.push("Propofol can cause severe hypotension in cardiogenic shock");
      teachingPoints.push("Consider ketamine for induction - it's more hemodynamically stable");
    }
    if ((order.params.peep as number || 0) >= 8 && context.shockStage >= 3) {
      warnings.push("High PEEP can reduce preload and worsen shock");
    }
    if (!order.params.pressorReady && context.shockStage >= 2) {
      teachingPoints.push("Always have vasopressors ready before intubating a patient in shock");
    }
  }

  // Milrinone warning
  if (order.type === "milrinone" && !context.hasEpiRunning) {
    warnings.push("Milrinone may cause hypotension without concurrent vasopressor support");
    teachingPoints.push("Start epinephrine before or with milrinone to prevent hypotensive crisis");
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    teachingPoints: teachingPoints.length > 0 ? teachingPoints : undefined,
  };
}
