import React, { ChangeEvent, useEffect, useState } from "react";
import { VoiceState, VoiceCommandType } from "../types";
import { PatientScenarioId, CharacterId } from "../types/voiceGateway";
import { setVoiceEnabled, releaseFloor, setAIMode } from "../hooks/useVoiceState";
import { sendVoiceCommand } from "../services/voiceCommands";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";

interface PresenterVoiceControlsProps {
  sessionId: string;
  voice: VoiceState;
  doctorQuestion: string;
  onDoctorQuestionChange: (text: string) => void;
  onForceReply?: (questionText: string, character: CharacterId) => void;
  autoForceReply: boolean;
  onToggleAutoForceReply: (enabled: boolean) => void;
  scenarioId: PatientScenarioId;
  scenarioOptions: { id: PatientScenarioId; label: string }[];
  onScenarioChange: (id: PatientScenarioId) => void;
  character: CharacterId;
  onCharacterChange: (c: CharacterId) => void;
}

async function emitCommand(
  sessionId: string,
  type: VoiceCommandType,
  payload?: Record<string, any> | undefined,
  character?: CharacterId
) {
  // Fire-and-forget Firestore; always attempt WS send
  sendVoiceCommand(sessionId, { type, payload, character }).catch((err) => {
    console.error("Failed to write voice command to Firestore", err);
  });
  try {
    voiceGatewayClient.sendVoiceCommand(type, payload, character);
  } catch (err) {
    console.error("Failed to send WS voice command", err);
  }
}

export function PresenterVoiceControls({
  sessionId,
  voice,
  doctorQuestion,
  onDoctorQuestionChange,
  onForceReply,
  autoForceReply,
  onToggleAutoForceReply,
  scenarioId,
  scenarioOptions,
  onScenarioChange,
  character,
  onCharacterChange,
}: PresenterVoiceControlsProps) {
  const [localQuestion, setLocalQuestion] = useState(doctorQuestion);
  const [quickStatus, setQuickStatus] = useState<string>("");
  const [quickTimer, setQuickTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalQuestion(doctorQuestion);
  }, [doctorQuestion]);

  const noteQuick = (msg: string) => {
    setQuickStatus(msg);
    if (quickTimer) clearTimeout(quickTimer);
    const t = setTimeout(() => setQuickStatus(""), 1200);
    setQuickTimer(t);
  };

  const handleToggle = async () => {
    await setVoiceEnabled(sessionId, !voice.enabled);
  };

  const handleRelease = async () => {
    await releaseFloor(sessionId);
  };

  const handleAIMode = async () => {
    await setAIMode(sessionId);
  };

  const handleQuestionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setLocalQuestion(e.target.value);
    onDoctorQuestionChange(e.target.value);
  };

  const handleForceReply = () => {
    const payload =
      localQuestion.trim().length > 0 ? { doctorUtterance: localQuestion.trim() } : undefined;
    if (onForceReply) {
      onForceReply(payload?.doctorUtterance ?? "", character);
    } else {
      emitCommand(sessionId, "force_reply", payload, character);
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 shadow-sm shadow-black/30 min-w-[260px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
          Voice Controls
        </div>
        <div className="text-[10px] text-slate-500">Force reply uses typed question</div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-300">
        <label className="uppercase tracking-[0.12em] text-slate-500 font-semibold">
          Patient case
        </label>
        <select
          value={scenarioId}
          onChange={(e) => onScenarioChange(e.target.value as PatientScenarioId)}
          className="text-sm bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-100"
        >
          {scenarioOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-300">
        <label className="uppercase tracking-[0.12em] text-slate-500 font-semibold">
          Target role
        </label>
        <select
          value={character}
          onChange={(e) => onCharacterChange(e.target.value as CharacterId)}
          className="text-sm bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-100"
        >
          <option value="patient">Patient</option>
          <option value="parent">Parent</option>
          <option value="nurse">Nurse</option>
          <option value="tech">Tech</option>
          <option value="consultant">Consultant</option>
        </select>
        <span className="text-[10px] text-slate-500">Force reply and commands target this role.</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
            voice.enabled
              ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-100"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          {voice.enabled ? "Disable voice" : "Enable voice"}
        </button>
        <button
          type="button"
          onClick={handleRelease}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-200"
        >
          Release floor
        </button>
        <button
          type="button"
          onClick={handleAIMode}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sky-600/60 bg-sky-600/10 text-sky-100 hover:border-sky-500"
        >
          Set AI speaking
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
          Doctor/Resident question
        </label>
        <textarea
          value={localQuestion}
          onChange={handleQuestionChange}
          rows={2}
          placeholder="Type what the resident just asked the patient..."
          className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/70 text-slate-100 text-sm px-2.5 py-2 focus:outline-none focus:border-slate-600"
        />
        <div className="text-[11px] text-slate-500">
          Optional; left blank uses a generic follow-up.
          {autoForceReply && (
            <span className="text-emerald-300 ml-1">Auto: will Force Reply after transcription.</span>
          )}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300 font-semibold">
          <input
            type="checkbox"
            checked={autoForceReply}
            onChange={(e) => onToggleAutoForceReply(e.target.checked)}
            className="accent-emerald-500"
          />
          Auto Force Reply after resident question
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => emitCommand(sessionId, "pause_ai")}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-200"
        >
          Pause AI
        </button>
        <button
          type="button"
          onClick={() => emitCommand(sessionId, "resume_ai")}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-200"
        >
          Resume AI
        </button>
        <button
          type="button"
          onClick={handleForceReply}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-emerald-600/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-500"
        >
          Force reply
        </button>
        <button
          type="button"
          onClick={() => emitCommand(sessionId, "end_turn")}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-rose-600/60 bg-rose-600/10 text-rose-100 hover:border-rose-500"
        >
          End turn
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "force_reply", { doctorUtterance: "Please grab a fresh set of vitals." }, "nurse");
            noteQuick("Sent to nurse: vitals request");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-emerald-600/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-500"
        >
          Ask nurse: vitals
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "order", { orderType: "ekg" }, "tech");
            noteQuick("Sent to tech: EKG");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-sky-600/60 bg-sky-600/10 text-sky-100 hover:border-sky-500"
        >
          Ask tech: EKG
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "exam", {}, "nurse");
            noteQuick("Exam requested");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-indigo-500/60 bg-indigo-600/10 text-indigo-100 hover:border-indigo-400"
        >
          Bedside exam
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "toggle_telemetry", { enabled: true }, "tech");
            noteQuick("Telemetry on");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-emerald-500/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-400"
        >
          Start telemetry
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "show_ekg", {}, "tech");
            noteQuick("Showing EKG");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-amber-500/60 bg-amber-600/10 text-amber-100 hover:border-amber-400"
        >
          Show EKG
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "order", { orderType: "labs" }, "nurse");
            noteQuick("Ordered labs (nurse)");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-indigo-600/60 bg-indigo-600/10 text-indigo-100 hover:border-indigo-500"
        >
          Order labs
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "order", { orderType: "imaging" }, "tech");
            noteQuick("Ordered imaging (tech)");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-purple-600/60 bg-purple-600/10 text-purple-100 hover:border-purple-500"
        >
          Order imaging
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "treatment", { treatmentType: "oxygen" }, "nurse");
            noteQuick("O2 applied");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-emerald-500/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-400"
        >
          Give oxygen
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "treatment", { treatmentType: "fluids" }, "nurse");
            noteQuick("Fluids bolus");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-sky-500/60 bg-sky-600/10 text-sky-100 hover:border-sky-400"
        >
          Fluids bolus
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "treatment", { treatmentType: "knee-chest" }, "nurse");
            noteQuick("Positioned knee-chest");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-amber-500/60 bg-amber-600/10 text-amber-100 hover:border-amber-400"
        >
          Knee-chest
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(sessionId, "treatment", { treatmentType: "rate-control" }, "nurse");
            noteQuick("Rate control med");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-rose-500/60 bg-rose-600/10 text-rose-100 hover:border-rose-400"
        >
          Rate control
        </button>
        <button
          type="button"
          onClick={() => {
            emitCommand(
              sessionId,
              "force_reply",
              { doctorUtterance: "Please join at bedside for cardiology consult." },
              "consultant"
            );
            noteQuick("Pinged consultant");
          }}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-amber-600/60 bg-amber-600/10 text-amber-100 hover:border-amber-500"
        >
          Call consultant
        </button>
      </div>
      {quickStatus && <div className="text-[11px] text-slate-400">{quickStatus}</div>}
    </div>
  );
}
