import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";

type Props = {
  isActive?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  targetRate?: number; // Default 110 BPM (middle of 100-120 range per PALS)
  showCompact?: boolean;
};

type FeedbackStatus = "good" | "too_slow" | "too_fast" | "idle";

function createBeepSound(audioContext: AudioContext, frequency: number = 880, duration: number = 0.05): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

export function CPRMetronome({
  isActive: externalActive,
  onStart,
  onStop,
  targetRate = 110,
  showCompact = false,
}: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [compressionCount, setCompressionCount] = useState(0);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackStatus>("idle");
  const [beatPhase, setBeatPhase] = useState(false); // For visual pulse
  const [volume, setVolume] = useState(0.5);
  const [elapsed, setElapsed] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const compressionTimesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);

  // Use external control if provided
  const running = externalActive !== undefined ? externalActive : isRunning;

  // Calculate interval for target rate
  const intervalMs = useMemo(() => 60000 / targetRate, [targetRate]);

  // Start metronome
  const startMetronome = useCallback(() => {
    if (running) return;

    // Initialize audio context on user interaction
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    setIsRunning(true);
    setCompressionCount(0);
    setCurrentRate(null);
    setFeedback("idle");
    compressionTimesRef.current = [];
    startTimeRef.current = Date.now();
    setElapsed(0);
    onStart?.();
  }, [running, onStart]);

  const stopMetronome = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setBeatPhase(false);
    startTimeRef.current = null;
    onStop?.();
  }, [onStop]);

  // Record a manual compression (tap)
  const recordCompression = useCallback(() => {
    const now = Date.now();
    compressionTimesRef.current.push(now);

    // Keep only last 10 compressions for rate calculation
    if (compressionTimesRef.current.length > 10) {
      compressionTimesRef.current.shift();
    }

    setCompressionCount((c) => c + 1);

    // Calculate rate from last few compressions
    if (compressionTimesRef.current.length >= 2) {
      const times = compressionTimesRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const rate = Math.round(60000 / avgInterval);
      setCurrentRate(rate);

      // Provide feedback
      if (rate < 100) {
        setFeedback("too_slow");
      } else if (rate > 120) {
        setFeedback("too_fast");
      } else {
        setFeedback("good");
      }
    }
  }, []);

  // Metronome tick effect
  useEffect(() => {
    if (running) {
      let lastBeat = Date.now();

      const tick = () => {
        const now = Date.now();
        if (now - lastBeat >= intervalMs) {
          lastBeat = now;

          // Play beep
          if (audioContextRef.current && volume > 0) {
            createBeepSound(audioContextRef.current, 880, 0.05);
          }

          // Visual pulse
          setBeatPhase(true);
          setTimeout(() => setBeatPhase(false), 100);

          // Update compression count (auto mode)
          setCompressionCount((c) => c + 1);
        }

        // Update elapsed time
        if (startTimeRef.current) {
          setElapsed(Math.floor((now - startTimeRef.current) / 1000));
        }
      };

      intervalRef.current = window.setInterval(tick, 10); // Check frequently for accuracy

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [running, intervalMs, volume]);

  // Format elapsed time
  const formatElapsed = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getFeedbackColor = (status: FeedbackStatus): string => {
    switch (status) {
      case "good":
        return "text-emerald-400";
      case "too_slow":
        return "text-amber-400";
      case "too_fast":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getFeedbackText = (status: FeedbackStatus): string => {
    switch (status) {
      case "good":
        return "Good rate!";
      case "too_slow":
        return "Push faster";
      case "too_fast":
        return "Slow down";
      default:
        return "—";
    }
  };

  if (showCompact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={running ? stopMetronome : startMetronome}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            running
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {running ? "Stop" : "Start"} Metronome
        </button>
        {running && (
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full transition-all ${
                beatPhase ? "bg-emerald-400 scale-125" : "bg-emerald-600"
              }`}
            />
            <span className="text-xs font-mono text-slate-300">{targetRate} BPM</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-700/40 bg-slate-900/80 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span className="text-sm font-bold text-emerald-200 uppercase tracking-wider">
            CPR Metronome
          </span>
        </div>
        <span className="text-[10px] text-slate-400">PALS: 100-120/min</span>
      </div>

      {/* Visual beat indicator */}
      <div className="flex justify-center mb-4">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-75 ${
            running
              ? beatPhase
                ? "bg-emerald-400 scale-110 shadow-lg shadow-emerald-400/50"
                : "bg-emerald-600"
              : "bg-slate-700"
          }`}
        >
          <svg
            className={`w-10 h-10 ${running ? "text-white" : "text-slate-500"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-black/40 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-500 uppercase">Target</div>
          <div className="text-lg font-mono font-bold text-emerald-300">{targetRate}</div>
          <div className="text-[9px] text-slate-500">BPM</div>
        </div>
        <div className="bg-black/40 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-500 uppercase">Count</div>
          <div className="text-lg font-mono font-bold text-slate-200">{compressionCount}</div>
          <div className="text-[9px] text-slate-500">compressions</div>
        </div>
        <div className="bg-black/40 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-500 uppercase">Time</div>
          <div className="text-lg font-mono font-bold text-slate-200">{formatElapsed(elapsed)}</div>
          <div className="text-[9px] text-slate-500">elapsed</div>
        </div>
      </div>

      {/* Rate feedback (for manual tapping mode) */}
      {currentRate !== null && (
        <div className="mb-4 p-2 bg-black/40 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase">Your Rate</span>
            <span className={`text-sm font-bold ${getFeedbackColor(feedback)}`}>
              {currentRate} BPM - {getFeedbackText(feedback)}
            </span>
          </div>
          {/* Rate bar */}
          <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 h-full bg-emerald-500/30"
              style={{ left: "calc(100 / 220 * 100%)", width: "calc(20 / 220 * 100%)" }}
            />
            <div
              className={`h-full transition-all ${
                feedback === "good" ? "bg-emerald-500" : feedback === "too_slow" ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, (currentRate / 220) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 mt-1">
            <span>0</span>
            <span className="text-emerald-400">100-120</span>
            <span>220</span>
          </div>
        </div>
      )}

      {/* Volume control */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer"
        />
        <span className="text-[10px] text-slate-400 w-8">{Math.round(volume * 100)}%</span>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={running ? stopMetronome : startMetronome}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
            running
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {running ? "Stop" : "Start"} Metronome
        </button>
        {running && (
          <button
            onClick={recordCompression}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
          >
            Tap
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-3 text-[10px] text-slate-500 text-center">
        {running ? (
          <>Push at the beep, or tap button to track your rate</>
        ) : (
          <>Start metronome for CPR timing assistance</>
        )}
      </div>
    </div>
  );
}

// Mini version for embedding in other components
export function CPRMetronomeMini({ onToggle }: { onToggle?: (running: boolean) => void }) {
  const [running, setRunning] = useState(false);

  const toggle = useCallback(() => {
    setRunning((r) => {
      const next = !r;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  return (
    <CPRMetronome
      isActive={running}
      onStart={() => setRunning(true)}
      onStop={() => setRunning(false)}
      showCompact
    />
  );
}
