import React from "react";
import { VoiceState, VoiceCommandType } from "../types";
import { setVoiceEnabled, releaseFloor, setAIMode } from "../hooks/useVoiceState";
import { sendVoiceCommand } from "../services/voiceCommands";

interface PresenterVoiceControlsProps {
  sessionId: string;
  voice: VoiceState;
}

async function emitCommand(sessionId: string, type: VoiceCommandType) {
  try {
    await sendVoiceCommand(sessionId, { type });
  } catch (err) {
    console.error("Failed to send command", err);
  }
}

export function PresenterVoiceControls({ sessionId, voice }: PresenterVoiceControlsProps) {
  const handleToggle = async () => {
    await setVoiceEnabled(sessionId, !voice.enabled);
  };

  const handleRelease = async () => {
    await releaseFloor(sessionId);
  };

  const handleAIMode = async () => {
    await setAIMode(sessionId);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 shadow-sm shadow-black/30">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Voice Controls</div>
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
      <div className="flex items-center gap-1">
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
          onClick={() => emitCommand(sessionId, "force_reply")}
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
      </div>
    </div>
  );
}
