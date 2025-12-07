import React from "react";
import { MicStatus } from "../services/VoicePatientService";
import { VoiceConnectionStatus } from "../types/voiceGateway";

type Props = {
  connection: VoiceConnectionStatus;
  micStatus: MicStatus;
  hasFloor: boolean;
  otherSpeaking: boolean;
  fallback?: boolean;
  onRetryVoice?: () => void;
  onRecheckMic?: () => void;
};

function toneClasses(tone: "ok" | "warn" | "error" | "info") {
  switch (tone) {
    case "ok":
      return "bg-emerald-500/15 border-emerald-500/50 text-emerald-100";
    case "warn":
      return "bg-amber-500/15 border-amber-500/50 text-amber-100";
    case "error":
      return "bg-rose-500/15 border-rose-500/50 text-rose-100";
    default:
      return "bg-sky-500/15 border-sky-500/50 text-sky-100";
  }
}

export function ParticipantVoiceStatusBanner({
  connection,
  micStatus,
  hasFloor,
  otherSpeaking,
  fallback = false,
  onRetryVoice,
  onRecheckMic,
}: Props) {
  let title = "Voice ready";
  let body = hasFloor ? "You have the floor. Hold to speak." : "Tap Take floor to ask your question.";
  let tone: "ok" | "warn" | "error" | "info" = "ok";
  const buttons: Array<{ label: string; onClick?: () => void }> = [];

  if (fallback) {
    tone = "warn";
    title = "Voice fallback (text mode)";
    body = "Patient voice paused. Use typed questions until voice resumes.";
  } else if (micStatus === "blocked") {
    tone = "error";
    title = "Microphone blocked";
    body = "Enable microphone in your browser settings, then tap Re-check mic.";
    buttons.push({ label: "Re-check mic", onClick: onRecheckMic });
  } else if (connection.state === "connecting") {
    tone = "info";
    title = "Connecting to voice…";
    body = "Please wait a moment.";
  } else if (connection.state === "disconnected" || connection.state === "error") {
    tone = "warn";
    title = "Voice connection lost";
    body = "Check your network and retry.";
    buttons.push({ label: "Retry voice", onClick: onRetryVoice });
  } else if (otherSpeaking) {
    tone = "info";
    title = "Another resident is speaking";
    body = "Wait for your turn to take the floor.";
  }

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm flex items-start justify-between gap-3 ${toneClasses(tone)}`}>
      <div>
        <div className="text-[12px] uppercase tracking-[0.12em] font-semibold">{title}</div>
        <div className="text-[12px] text-slate-200/90">{body}</div>
      </div>
      <div className="flex items-center gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-600 bg-slate-900 hover:border-slate-500 text-slate-100"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
