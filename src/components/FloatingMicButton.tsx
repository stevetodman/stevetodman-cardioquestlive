import React, { useCallback, useState, useEffect } from "react";

type ConnectionState = "connected" | "connecting" | "disconnected";

interface FloatingMicButtonProps {
  disabled?: boolean;
  onPressStart?: () => Promise<void> | void;
  onPressEnd?: () => Promise<void> | void;
  statusLabel?: string;
  connectionState?: ConnectionState;
  aiSpeaking?: boolean;
}

export function FloatingMicButton({
  disabled,
  onPressStart,
  onPressEnd,
  statusLabel = "Hold to speak",
  connectionState = "connected",
  aiSpeaking = false,
}: FloatingMicButtonProps) {
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");
  const [pulseRing, setPulseRing] = useState(false);

  // Pulse ring animation when ready to speak
  useEffect(() => {
    if (!disabled && connectionState === "connected" && !aiSpeaking && state === "idle") {
      setPulseRing(true);
    } else {
      setPulseRing(false);
    }
  }, [disabled, connectionState, aiSpeaking, state]);

  const handleDown = useCallback(async () => {
    if (disabled || state === "recording" || state === "requesting") return;
    // Haptic feedback on press
    try {
      navigator.vibrate?.(30);
    } catch {
      // no-op
    }
    setState("requesting");
    try {
      await onPressStart?.();
      setState("recording");
    } catch {
      setState("idle");
    }
  }, [disabled, onPressStart, state]);

  const handleUp = useCallback(async () => {
    // Only send stop_speaking if we were actually recording (start_speaking succeeded)
    // Don't send stop if we were still in "requesting" state (start_speaking not yet sent)
    if (state !== "recording") {
      setState("idle");
      return;
    }
    // Haptic feedback on release
    try {
      navigator.vibrate?.(50);
    } catch {
      // no-op
    }
    setState("idle");
    await onPressEnd?.();
  }, [onPressEnd, state]);

  // Visual states
  const isRecording = state === "recording";
  const isRequesting = state === "requesting";
  const isReady = !disabled && connectionState === "connected" && !aiSpeaking;
  const isConnecting = connectionState === "connecting";

  // Button background styles
  const buttonBg = isRecording
    ? "bg-emerald-500 shadow-xl shadow-emerald-500/50"
    : isRequesting
    ? "bg-sky-500 shadow-lg shadow-sky-500/40"
    : aiSpeaking
    ? "bg-amber-600/80 shadow-lg shadow-amber-500/30"
    : disabled
    ? "bg-slate-800/80 border-slate-700"
    : isConnecting
    ? "bg-slate-700 border-slate-600"
    : "bg-slate-900 border-slate-600 shadow-lg shadow-black/30";

  // Icon based on state
  const icon = isRecording ? (
    // Recording waveform icon
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="8" width="2" height="8" rx="1" className="animate-pulse" />
      <rect x="8" y="5" width="2" height="14" rx="1" className="animate-pulse" style={{ animationDelay: "0.1s" }} />
      <rect x="12" y="7" width="2" height="10" rx="1" className="animate-pulse" style={{ animationDelay: "0.2s" }} />
      <rect x="16" y="4" width="2" height="16" rx="1" className="animate-pulse" style={{ animationDelay: "0.15s" }} />
      <rect x="20" y="9" width="2" height="6" rx="1" className="animate-pulse" style={{ animationDelay: "0.25s" }} />
    </svg>
  ) : aiSpeaking ? (
    // AI speaking icon (sound waves)
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6v12M8 9v6M16 9v6M4 11v2M20 11v2" strokeLinecap="round" className="animate-pulse" />
    </svg>
  ) : (
    // Microphone icon
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={isReady ? "currentColor" : "none"} />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
    </svg>
  );

  // Status label
  const displayLabel = isRecording
    ? "Release to stop"
    : isRequesting
    ? "Starting…"
    : aiSpeaking
    ? "Patient speaking"
    : isConnecting
    ? "Connecting…"
    : disabled
    ? "Voice unavailable"
    : statusLabel;

  return (
    <div
      className="fixed z-40 flex flex-col items-center"
      style={{
        right: "16px",
        bottom: "calc(20px + env(safe-area-inset-bottom))",
      }}
    >
      {/* Pulse ring when ready */}
      <div className="relative">
        {pulseRing && (
          <div className="absolute inset-0 w-[72px] h-[72px] -m-1 rounded-full bg-emerald-500/20 animate-ping" />
        )}
        {isRecording && (
          <div className="absolute inset-0 w-[72px] h-[72px] -m-1 rounded-full bg-emerald-500/30 animate-pulse" />
        )}
        <button
          type="button"
          className={`relative w-[68px] h-[68px] rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90 touch-none select-none ${buttonBg} ${
            disabled ? "text-slate-500 cursor-not-allowed" : "text-white"
          }`}
          disabled={disabled}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            handleDown();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
            handleUp();
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
            handleUp();
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            handleUp();
          }}
          aria-label={displayLabel}
          aria-pressed={isRecording}
        >
          {icon}
        </button>
      </div>

      {/* Status label */}
      <div
        className={`mt-2 text-xs font-medium text-center max-w-[90px] leading-tight transition-colors ${
          isRecording
            ? "text-emerald-300"
            : aiSpeaking
            ? "text-amber-300"
            : disabled
            ? "text-slate-500"
            : "text-slate-300"
        }`}
      >
        {displayLabel}
      </div>
    </div>
  );
}
