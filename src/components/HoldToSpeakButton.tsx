import React, { useCallback, useMemo, useRef, useState } from "react";

type HoldState = "idle" | "requesting" | "recording" | "disabled";

interface HoldToSpeakButtonProps {
  disabled?: boolean;
  onPressStart?: () => Promise<void> | void;
  onPressEnd?: () => Promise<void> | void;
  labelIdle?: string;
  labelDisabled?: string;
  helperText?: string;
  className?: string;
}

/**
 * Press-and-hold button for voice capture. Pointer/touch friendly and prevents scroll while held.
 */
export function HoldToSpeakButton({
  disabled,
  onPressStart,
  onPressEnd,
  labelIdle = "Hold to speak",
  labelDisabled = "Voice unavailable",
  helperText,
  className = "",
}: HoldToSpeakButtonProps) {
  const [state, setState] = useState<HoldState>(disabled ? "disabled" : "idle");
  const pressActive = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const startPress = useCallback(async () => {
    if (disabled || state === "recording") return;
    pressActive.current = true;
    setState("requesting");
    try {
      await onPressStart?.();
      if (pressActive.current) {
        setState("recording");
      } else {
        setState(disabled ? "disabled" : "idle");
      }
    } catch (err) {
      console.error("Press start failed", err);
      setState(disabled ? "disabled" : "idle");
      pressActive.current = false;
    }
  }, [disabled, onPressStart, state]);

  const endPress = useCallback(async () => {
    if (!pressActive.current) return;
    pressActive.current = false;
    setState(disabled ? "disabled" : "idle");
    try {
      await onPressEnd?.();
    } catch (err) {
      console.error("Press end failed", err);
    }
  }, [disabled, onPressEnd]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Prevent touch scrolling while holding
      e.preventDefault();
      const target = e.target as HTMLElement;
      target.setPointerCapture?.(e.pointerId);
      buttonRef.current = target as HTMLButtonElement;
      startPress();
    },
    [startPress]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      endPress();
    },
    [endPress]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      endPress();
    },
    [endPress]
  );

  const label = useMemo(() => {
    if (state === "disabled") return labelDisabled;
    if (state === "requesting") return "Requesting mic…";
    if (state === "recording") return "Release to stop";
    return labelIdle;
  }, [labelDisabled, labelIdle, state]);

  const visualState =
    state === "recording"
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-emerald-500 scale-[0.995]"
      : state === "requesting"
      ? "bg-sky-600 text-white border-sky-500"
      : disabled
      ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
      : "bg-slate-900 text-slate-100 border-slate-700 hover:border-slate-600";

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        ref={buttonRef}
        className={`w-full rounded-2xl px-4 py-5 text-base font-semibold border transition-all active:scale-[0.99] touch-none select-none shadow-lg ${visualState}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        disabled={disabled}
      >
        <div className="flex items-center justify-center gap-2">
          {state === "recording" && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 animate-pulse"></span>
          )}
          {state === "requesting" && (
            <span className="w-2.5 h-2.5 rounded-full bg-sky-200 animate-pulse"></span>
          )}
          <span>{label}</span>
        </div>
      </button>
      {helperText && (
        <div className="text-[12px] text-center text-slate-400 leading-tight px-1">
          {helperText}
        </div>
      )}
    </div>
  );
}
