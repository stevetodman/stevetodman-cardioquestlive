import React, { useCallback, useState } from "react";

interface FloatingMicButtonProps {
  disabled?: boolean;
  onPressStart?: () => Promise<void> | void;
  onPressEnd?: () => Promise<void> | void;
  statusLabel?: string;
}

export function FloatingMicButton({
  disabled,
  onPressStart,
  onPressEnd,
  statusLabel = "Hold to speak",
}: FloatingMicButtonProps) {
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");

  const handleDown = useCallback(async () => {
    if (disabled || state === "recording" || state === "requesting") return;
    setState("requesting");
    try {
      await onPressStart?.();
      setState("recording");
    } catch {
      setState("idle");
    }
  }, [disabled, onPressStart, state]);

  const handleUp = useCallback(async () => {
    if (state !== "recording" && state !== "requesting") return;
    setState("idle");
    await onPressEnd?.();
  }, [onPressEnd, state]);

  const bg =
    state === "recording"
      ? "bg-emerald-600 shadow-lg shadow-emerald-500/40"
      : state === "requesting"
      ? "bg-sky-600 shadow-lg shadow-sky-500/40"
      : disabled
      ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
      : "bg-slate-900 text-slate-100 border-slate-700";

  return (
    <div
      className="fixed z-40"
      style={{
        right: "16px",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-150 active:scale-95 ${bg}`}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          handleDown();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          handleUp();
        }}
        onPointerLeave={(e) => {
          e.preventDefault();
          handleUp();
        }}
        aria-label={statusLabel}
      >
        <span className="text-lg">🎙️</span>
      </button>
      <div className="mt-1 text-[11px] text-slate-300 text-center max-w-[80px] leading-tight">
        {state === "recording" ? "Recording…" : statusLabel}
      </div>
    </div>
  );
}
