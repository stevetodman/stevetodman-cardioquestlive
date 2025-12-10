import React, { useState } from "react";

export type InjectCategory = "vitals" | "equipment" | "patient" | "family" | "staff";

export interface Inject {
  id: string;
  label: string;
  description: string;
  category: InjectCategory;
  icon: string;
  payload: {
    eventType: string;
    vitalsChange?: Record<string, number | string>;
    patientChange?: string;
    announcement?: string;
    character?: string;
  };
}

// Pre-defined clinical injects organized by category
const INJECTS: Inject[] = [
  // === VITALS DETERIORATION ===
  {
    id: "spo2_drop",
    label: "SpO2 Drop",
    description: "Sudden desaturation to 88%",
    category: "vitals",
    icon: "📉",
    payload: {
      eventType: "vitals_change",
      vitalsChange: { spo2: 88 },
      announcement: "Alarm! SpO2 dropping... now at 88%.",
    },
  },
  {
    id: "hr_spike",
    label: "HR Spike",
    description: "Tachycardia to 180 bpm",
    category: "vitals",
    icon: "💓",
    payload: {
      eventType: "vitals_change",
      vitalsChange: { hr: 180 },
      announcement: "Heart rate spiking... 180!",
    },
  },
  {
    id: "bradycardia",
    label: "Bradycardia",
    description: "Heart rate drops to 45 bpm",
    category: "vitals",
    icon: "🐢",
    payload: {
      eventType: "vitals_change",
      vitalsChange: { hr: 45 },
      announcement: "Heart rate dropping... 45 and falling.",
    },
  },
  {
    id: "hypotension",
    label: "Hypotension",
    description: "BP drops to 70/40",
    category: "vitals",
    icon: "⬇️",
    payload: {
      eventType: "vitals_change",
      vitalsChange: { bp: "70/40" },
      announcement: "Blood pressure crashing... 70 over 40.",
    },
  },
  {
    id: "fever_spike",
    label: "Fever Spike",
    description: "Temperature rises to 39.5°C",
    category: "vitals",
    icon: "🌡️",
    payload: {
      eventType: "vitals_change",
      vitalsChange: { temp: 39.5 },
      announcement: "Temperature rising... 39.5 degrees.",
    },
  },

  // === EQUIPMENT ISSUES ===
  {
    id: "iv_dislodged",
    label: "IV Dislodged",
    description: "IV line comes out",
    category: "equipment",
    icon: "💉",
    payload: {
      eventType: "equipment_failure",
      patientChange: "iv_lost",
      announcement: "The IV just came out! We need access!",
      character: "nurse",
    },
  },
  {
    id: "monitor_artifact",
    label: "Monitor Artifact",
    description: "Leads disconnected",
    category: "equipment",
    icon: "📺",
    payload: {
      eventType: "equipment_failure",
      patientChange: "monitor_artifact",
      announcement: "Getting artifact on the monitor. Let me check the leads.",
      character: "tech",
    },
  },
  {
    id: "o2_disconnected",
    label: "O2 Disconnected",
    description: "Oxygen tubing comes off",
    category: "equipment",
    icon: "💨",
    payload: {
      eventType: "equipment_failure",
      patientChange: "oxygen_lost",
      announcement: "Oxygen tubing disconnected!",
      character: "nurse",
    },
  },

  // === PATIENT CHANGES ===
  {
    id: "vomiting",
    label: "Vomiting",
    description: "Patient starts vomiting",
    category: "patient",
    icon: "🤢",
    payload: {
      eventType: "patient_symptom",
      patientChange: "vomiting",
      announcement: "Patient's vomiting! I need suction!",
      character: "nurse",
    },
  },
  {
    id: "coughing",
    label: "Coughing Fit",
    description: "Non-productive cough",
    category: "patient",
    icon: "😷",
    payload: {
      eventType: "patient_symptom",
      patientChange: "coughing",
      announcement: "Patient started coughing.",
      character: "nurse",
    },
  },
  {
    id: "agitation",
    label: "Agitation",
    description: "Patient becomes restless",
    category: "patient",
    icon: "😰",
    payload: {
      eventType: "patient_symptom",
      patientChange: "agitated",
      announcement: "Patient's getting agitated, trying to pull at the lines.",
      character: "nurse",
    },
  },
  {
    id: "seizure",
    label: "Seizure",
    description: "Patient seizes",
    category: "patient",
    icon: "⚡",
    payload: {
      eventType: "patient_symptom",
      patientChange: "seizure",
      announcement: "Patient's seizing! Starting the clock!",
      character: "nurse",
    },
  },
  {
    id: "unresponsive",
    label: "Unresponsive",
    description: "Patient becomes unresponsive",
    category: "patient",
    icon: "😵",
    payload: {
      eventType: "patient_symptom",
      patientChange: "unresponsive",
      announcement: "Patient's not responding! Check a pulse!",
      character: "nurse",
    },
  },

  // === FAMILY DYNAMICS ===
  {
    id: "anxious_parent",
    label: "Anxious Parent",
    description: "Parent becomes worried",
    category: "family",
    icon: "😟",
    payload: {
      eventType: "family_interjection",
      character: "parent",
      announcement: "What's happening? Is my child going to be okay? Someone please tell me what's going on!",
    },
  },
  {
    id: "demanding_parent",
    label: "Demanding Parent",
    description: "Parent asks for attending",
    category: "family",
    icon: "😤",
    payload: {
      eventType: "family_interjection",
      character: "parent",
      announcement: "I want to speak to the attending physician right now. Where is the real doctor?",
    },
  },
  {
    id: "crying_parent",
    label: "Crying Parent",
    description: "Parent breaks down",
    category: "family",
    icon: "😢",
    payload: {
      eventType: "family_interjection",
      character: "parent",
      announcement: "I can't... I just can't watch this. This is my baby...",
    },
  },

  // === STAFF INTERRUPTIONS ===
  {
    id: "consultant_call",
    label: "Consultant Calling",
    description: "Specialist on the phone",
    category: "staff",
    icon: "📞",
    payload: {
      eventType: "staff_interjection",
      character: "consultant",
      announcement: "Cardiology here, returning your page. What have you got?",
    },
  },
  {
    id: "lab_result",
    label: "Critical Lab Result",
    description: "Lab calls with critical",
    category: "staff",
    icon: "🧪",
    payload: {
      eventType: "staff_interjection",
      character: "tech",
      announcement: "Lab just called with a critical - troponin is elevated.",
    },
  },
  {
    id: "code_team",
    label: "Code Team Arrives",
    description: "Rapid response arrives",
    category: "staff",
    icon: "🏃",
    payload: {
      eventType: "staff_interjection",
      character: "nurse",
      announcement: "Code team is here. What do you need?",
    },
  },
];

const CATEGORY_LABELS: Record<InjectCategory, string> = {
  vitals: "Vitals Changes",
  equipment: "Equipment Issues",
  patient: "Patient Symptoms",
  family: "Family Dynamics",
  staff: "Staff Interruptions",
};

const CATEGORY_COLORS: Record<InjectCategory, string> = {
  vitals: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
  equipment: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  patient: "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20",
  family: "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20",
  staff: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20",
};

interface InjectsPaletteProps {
  onInject: (inject: Inject) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function InjectsPalette({ onInject, disabled = false, compact = false }: InjectsPaletteProps) {
  const [expandedCategory, setExpandedCategory] = useState<InjectCategory | null>(null);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);

  const handleInject = (inject: Inject) => {
    if (disabled) return;
    onInject(inject);
    // Track recently used (keep last 3)
    setRecentlyUsed((prev) => [inject.id, ...prev.filter((id) => id !== inject.id)].slice(0, 3));
  };

  const categories = Object.keys(CATEGORY_LABELS) as InjectCategory[];

  // Get recently used injects
  const recentInjects = recentlyUsed
    .map((id) => INJECTS.find((i) => i.id === id))
    .filter(Boolean) as Inject[];

  return (
    <div className={`bg-slate-900/60 border border-slate-700 rounded-lg ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Scenario Injects
        </h3>
        <span className="text-[9px] text-slate-500">
          Click to trigger
        </span>
      </div>

      {/* Recently Used */}
      {recentInjects.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] text-slate-500 mb-1">Recent</div>
          <div className="flex flex-wrap gap-1">
            {recentInjects.map((inject) => (
              <button
                key={`recent-${inject.id}`}
                onClick={() => handleInject(inject)}
                disabled={disabled}
                className={`px-2 py-1 text-[10px] rounded border ${CATEGORY_COLORS[inject.category]}
                  text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                title={inject.description}
              >
                {inject.icon} {inject.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-1">
        {categories.map((category) => {
          const categoryInjects = INJECTS.filter((i) => i.category === category);
          const isExpanded = expandedCategory === category;

          return (
            <div key={category}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded border
                  ${CATEGORY_COLORS[category]} text-slate-200 text-[11px] transition-colors`}
              >
                <span>{CATEGORY_LABELS[category]}</span>
                <span className="text-slate-400">{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded && (
                <div className="mt-1 ml-2 space-y-1">
                  {categoryInjects.map((inject) => (
                    <button
                      key={inject.id}
                      onClick={() => handleInject(inject)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border
                        ${CATEGORY_COLORS[category]} text-slate-200 text-[10px] text-left
                        transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={inject.description}
                    >
                      <span className="text-sm">{inject.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{inject.label}</div>
                        <div className="text-slate-400 text-[9px] truncate">{inject.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
