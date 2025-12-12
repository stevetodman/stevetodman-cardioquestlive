import React from "react";
import { MicStatus } from "../services/VoicePatientService";
import { VoiceConnectionStatus } from "../types/voiceGateway";

type Props = {
  connection: VoiceConnectionStatus;
  micStatus: MicStatus;
  hasFloor: boolean;
  otherSpeaking: boolean;
  queuePosition?: number;
  fallback?: boolean;
  throttled?: boolean;
  locked?: boolean;
  onRetryVoice?: () => void;
  onRecheckMic?: () => void;
  onUseTextInstead?: () => void;
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
  queuePosition,
  fallback = false,
  throttled = false,
  locked = false,
  onRetryVoice,
  onRecheckMic,
  onUseTextInstead,
}: Props) {
  let title = "Voice ready";
  let body = hasFloor ? "You have the floor. Hold to speak." : "Tap Take floor to ask your question.";
  let tone: "ok" | "warn" | "error" | "info" = "ok";
  const buttons: Array<{ label: string; onClick?: () => void }> = [];
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);

  if (fallback) {
    tone = "warn";
    title = "Voice fallback (text mode)";
    body = "Patient voice paused. Use typed questions until voice resumes.";
  } else if (locked) {
    tone = "warn";
    title = "Floor locked by presenter";
    body = "Wait for the presenter to unlock or hand you the floor.";
  } else if (throttled) {
    tone = "info";
    title = "Voice throttled";
    body = "Shorter answers to manage budget.";
  } else if (micStatus === "blocked") {
    tone = "error";
    title = "Microphone blocked";
    body = `Enable microphone in your browser settings, then tap Re-check mic.${
      isSafari ? " On Safari, tap the aA icon → Website Settings → Microphone → Allow." : ""
    }${isFirefox ? " On Firefox, use the mic icon in the address bar to allow access." : ""}`;
    buttons.push({ label: "Re-check mic", onClick: onRecheckMic });
    if (onUseTextInstead) {
      buttons.push({ label: "Type question instead", onClick: onUseTextInstead });
    }
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
    const queueText = queuePosition && queuePosition > 0
      ? `You're #${queuePosition} in queue.`
      : "Wait for your turn to take the floor.";
    body = queueText;
  }

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm flex items-start justify-between gap-3 ${toneClasses(tone)}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div>
        <div className="text-[12px] uppercase tracking-[0.12em] font-semibold">{title}</div>
        <div className="text-[12px] text-slate-200/90">{body}</div>
        {micStatus === "blocked" && (
          <ol className="mt-1 text-[11px] text-slate-300 space-y-0.5 list-decimal list-inside">
            <li>Click the lock/URL bar icon.</li>
            <li>Allow microphone access.</li>
            <li>Come back and tap Re-check mic.</li>
          </ol>
        )}
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
