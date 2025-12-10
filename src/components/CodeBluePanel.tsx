import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { CPRMetronomeMini } from "./CPRMetronome";

type CodeBlueRhythm = "vfib" | "vtach" | "asystole" | "pea" | null;

type Props = {
  rhythmSummary?: string;
  onCodeStart?: () => void;
  onCodeEnd?: () => void;
  onPulseCheck?: (intervalNumber: number) => void;
};

function detectCodeBlueRhythm(summary?: string): CodeBlueRhythm {
  if (!summary) return null;
  const s = summary.toLowerCase();
  if (s.includes("vfib") || s.includes("ventricular fibrillation")) return "vfib";
  if (s.includes("vtach") || s.includes("ventricular tachycardia")) return "vtach";
  if (s.includes("asystole") || s.includes("flatline")) return "asystole";
  if (s.includes("pea") || s.includes("pulseless electrical")) return "pea";
  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getRhythmLabel(rhythm: CodeBlueRhythm): string {
  switch (rhythm) {
    case "vfib": return "V-Fib";
    case "vtach": return "V-Tach";
    case "asystole": return "Asystole";
    case "pea": return "PEA";
    default: return "Unknown";
  }
}

function isShockable(rhythm: CodeBlueRhythm): boolean {
  return rhythm === "vfib" || rhythm === "vtach";
}

type PALSAction = {
  time: number; // seconds from code start
  action: string;
  type: "pulse_check" | "epi" | "shock" | "rhythm_check" | "amiodarone";
  completed: boolean;
};

function generatePALSChecklist(shockable: boolean): PALSAction[] {
  const actions: PALSAction[] = [];

  // PALS protocol timing (simplified)
  // - Pulse/rhythm check every 2 minutes
  // - Epinephrine every 3-5 minutes (first dose asap for non-shockable)
  // - Amiodarone after 2 shocks for shockable rhythms

  for (let i = 1; i <= 10; i++) {
    const time = i * 120; // every 2 minutes
    actions.push({
      time,
      action: `Pulse Check #${i}`,
      type: "pulse_check",
      completed: false,
    });

    // Add rhythm check with each pulse check
    actions.push({
      time,
      action: `Rhythm Check #${i}`,
      type: "rhythm_check",
      completed: false,
    });
  }

  // Epinephrine every 3-5 minutes (we'll use 4 min intervals after first)
  // First epi: immediately for non-shockable, after first shock for shockable
  if (!shockable) {
    actions.push({ time: 0, action: "Epinephrine 0.01 mg/kg IV/IO", type: "epi", completed: false });
  } else {
    actions.push({ time: 120, action: "Epinephrine 0.01 mg/kg IV/IO (after 1st shock)", type: "epi", completed: false });
  }

  // Subsequent epi doses
  for (let i = 1; i <= 4; i++) {
    const baseTime = shockable ? 120 : 0;
    actions.push({
      time: baseTime + i * 240, // every 4 minutes
      action: `Epinephrine 0.01 mg/kg (#${i + 1})`,
      type: "epi",
      completed: false,
    });
  }

  if (shockable) {
    // First shock immediately for shockable rhythms
    actions.push({ time: 0, action: "Defibrillate 2 J/kg", type: "shock", completed: false });
    actions.push({ time: 120, action: "Defibrillate 4 J/kg (if still shockable)", type: "shock", completed: false });
    // Amiodarone after 2nd shock
    actions.push({ time: 240, action: "Amiodarone 5 mg/kg IV/IO (if refractory VF/pVT)", type: "amiodarone", completed: false });
    actions.push({ time: 480, action: "Amiodarone 5 mg/kg (may repeat x1)", type: "amiodarone", completed: false });
  }

  return actions.sort((a, b) => a.time - b.time);
}

export function CodeBluePanel({ rhythmSummary, onCodeStart, onCodeEnd, onPulseCheck }: Props) {
  const [codeActive, setCodeActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [codeStartTime, setCodeStartTime] = useState<number | null>(null);
  const [currentRhythm, setCurrentRhythm] = useState<CodeBlueRhythm>(null);
  const [palsActions, setPalsActions] = useState<PALSAction[]>([]);
  const [pulseCheckAlertVisible, setPulseCheckAlertVisible] = useState(false);
  const [nextPulseCheckIn, setNextPulseCheckIn] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastPulseCheckRef = useRef<number>(0);

  const detectedRhythm = useMemo(() => detectCodeBlueRhythm(rhythmSummary), [rhythmSummary]);

  // Auto-detect code blue rhythms
  useEffect(() => {
    if (detectedRhythm && !codeActive) {
      // Auto-start code blue for critical rhythms
      setCurrentRhythm(detectedRhythm);
    } else if (!detectedRhythm && codeActive && currentRhythm) {
      // Rhythm changed to non-critical - prompt to end code
      // Don't auto-end, let user decide
    }
  }, [detectedRhythm, codeActive, currentRhythm]);

  const startCode = useCallback(() => {
    if (codeActive) return;
    const now = Date.now();
    setCodeActive(true);
    setCodeStartTime(now);
    setElapsedSeconds(0);
    lastPulseCheckRef.current = 0;

    const rhythm = detectedRhythm || "asystole"; // default to asystole if unknown
    setCurrentRhythm(rhythm);
    setPalsActions(generatePALSChecklist(isShockable(rhythm)));

    onCodeStart?.();
  }, [codeActive, detectedRhythm, onCodeStart]);

  const endCode = useCallback(() => {
    setCodeActive(false);
    setCodeStartTime(null);
    setElapsedSeconds(0);
    setPalsActions([]);
    setPulseCheckAlertVisible(false);
    setNextPulseCheckIn(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCodeEnd?.();
  }, [onCodeEnd]);

  const markActionComplete = useCallback((index: number) => {
    setPalsActions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], completed: true };
      return updated;
    });
  }, []);

  // Timer effect
  useEffect(() => {
    if (codeActive && codeStartTime) {
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeStartTime) / 1000);
        setElapsedSeconds(elapsed);

        // Check for pulse check interval (every 2 minutes)
        const pulseCheckInterval = 120;
        const currentInterval = Math.floor(elapsed / pulseCheckInterval);
        const timeInCurrentInterval = elapsed % pulseCheckInterval;
        const timeUntilNext = pulseCheckInterval - timeInCurrentInterval;

        setNextPulseCheckIn(timeUntilNext);

        // Show alert when approaching pulse check (10 seconds before)
        if (timeUntilNext <= 10 && timeUntilNext > 0) {
          setPulseCheckAlertVisible(true);
        } else if (timeInCurrentInterval < 5) {
          // Just passed pulse check time
          if (currentInterval > lastPulseCheckRef.current) {
            onPulseCheck?.(currentInterval);
            lastPulseCheckRef.current = currentInterval;
          }
          setPulseCheckAlertVisible(false);
        } else {
          setPulseCheckAlertVisible(false);
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [codeActive, codeStartTime, onPulseCheck]);

  // Upcoming actions within next 30 seconds
  const upcomingActions = useMemo(() => {
    return palsActions.filter(a => !a.completed && a.time <= elapsedSeconds + 30 && a.time >= elapsedSeconds - 5);
  }, [palsActions, elapsedSeconds]);

  // Get status color
  const statusColor = useMemo(() => {
    if (!codeActive) return "slate";
    if (pulseCheckAlertVisible) return "amber";
    return "red";
  }, [codeActive, pulseCheckAlertVisible]);

  // If no critical rhythm detected and code not active, show minimal UI
  if (!codeActive && !detectedRhythm) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border-2 p-3 transition-all duration-300 ${
        codeActive
          ? pulseCheckAlertVisible
            ? "border-amber-500 bg-amber-500/10 animate-pulse"
            : "border-red-500 bg-red-500/10"
          : "border-red-500/50 bg-red-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              codeActive ? "bg-red-500 animate-pulse" : "bg-red-500/50"
            }`}
          />
          <span className="text-sm font-bold text-red-200 uppercase tracking-wider">
            {codeActive ? "CODE BLUE ACTIVE" : "CRITICAL RHYTHM DETECTED"}
          </span>
        </div>
        {!codeActive && detectedRhythm && (
          <button
            onClick={startCode}
            className="px-3 py-1 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            START CODE
          </button>
        )}
        {codeActive && (
          <button
            onClick={endCode}
            className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            End Code
          </button>
        )}
      </div>

      {/* Rhythm indicator */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`px-3 py-1 rounded-lg text-sm font-bold ${
            isShockable(currentRhythm || detectedRhythm)
              ? "bg-amber-500/30 text-amber-200 border border-amber-500/50"
              : "bg-blue-500/30 text-blue-200 border border-blue-500/50"
          }`}
        >
          {getRhythmLabel(currentRhythm || detectedRhythm)}
          {isShockable(currentRhythm || detectedRhythm) ? " (Shockable)" : " (Non-Shockable)"}
        </div>
      </div>

      {codeActive && (
        <>
          {/* Timer display */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-black/40 rounded-lg p-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Code Duration</div>
              <div className="text-2xl font-mono font-bold text-red-300">{formatTime(elapsedSeconds)}</div>
            </div>
            <div
              className={`rounded-lg p-2 text-center ${
                pulseCheckAlertVisible ? "bg-amber-500/30 animate-pulse" : "bg-black/40"
              }`}
            >
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Next Pulse Check</div>
              <div
                className={`text-2xl font-mono font-bold ${
                  pulseCheckAlertVisible ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                {nextPulseCheckIn !== null ? formatTime(nextPulseCheckIn) : "--:--"}
              </div>
            </div>
          </div>

          {/* CPR Metronome */}
          <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-xs font-bold text-emerald-200 uppercase">CPR Metronome</span>
              </div>
              <CPRMetronomeMini />
            </div>
          </div>

          {/* Pulse check alert */}
          {pulseCheckAlertVisible && (
            <div className="mb-3 p-2 bg-amber-500/20 border border-amber-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-amber-200">
                <svg className="w-5 h-5 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-bold text-sm">PULSE CHECK APPROACHING - Prepare to pause CPR</span>
              </div>
            </div>
          )}

          {/* Upcoming actions */}
          {upcomingActions.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Due Now</div>
              <div className="space-y-1">
                {upcomingActions.map((action, idx) => (
                  <div
                    key={`${action.type}-${action.time}-${idx}`}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      action.type === "shock"
                        ? "bg-amber-500/20 border border-amber-500/40"
                        : action.type === "epi" || action.type === "amiodarone"
                        ? "bg-blue-500/20 border border-blue-500/40"
                        : "bg-slate-700/50 border border-slate-600/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono ${
                          action.time <= elapsedSeconds ? "text-red-300" : "text-slate-400"
                        }`}
                      >
                        {formatTime(action.time)}
                      </span>
                      <span className="text-sm text-slate-200">{action.action}</span>
                    </div>
                    {!action.completed && (
                      <button
                        onClick={() => {
                          const originalIndex = palsActions.findIndex(
                            a => a.time === action.time && a.action === action.action
                          );
                          if (originalIndex >= 0) markActionComplete(originalIndex);
                        }}
                        className="px-2 py-0.5 text-[10px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                      >
                        Done
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PALS Protocol Summary */}
          <div className="border-t border-slate-700/50 pt-2">
            <details className="group">
              <summary className="cursor-pointer text-[10px] text-slate-400 uppercase tracking-wider hover:text-slate-300">
                PALS Protocol Checklist
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {palsActions.map((action, idx) => (
                  <div
                    key={`pals-${idx}`}
                    className={`flex items-center gap-2 p-1.5 rounded text-xs ${
                      action.completed
                        ? "bg-emerald-500/10 text-emerald-300 line-through"
                        : action.time <= elapsedSeconds
                        ? "bg-red-500/10 text-red-300"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="font-mono w-12">{formatTime(action.time)}</span>
                    <span className="flex-1">{action.action}</span>
                    {!action.completed && (
                      <button
                        onClick={() => markActionComplete(idx)}
                        className="px-1.5 py-0.5 text-[9px] bg-slate-700 hover:bg-slate-600 rounded"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}

export function CodeBlueIndicator({ rhythmSummary }: { rhythmSummary?: string }) {
  const rhythm = detectCodeBlueRhythm(rhythmSummary);

  if (!rhythm) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded-lg animate-pulse">
      <div className="w-2 h-2 rounded-full bg-red-500" />
      <span className="text-xs font-bold text-red-200 uppercase">
        {getRhythmLabel(rhythm)} - Critical
      </span>
    </div>
  );
}
