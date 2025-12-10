import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";

type RhythmType =
  | "sinus"
  | "sinus_tachycardia"
  | "sinus_bradycardia"
  | "svt"
  | "vtach"
  | "vfib"
  | "afib"
  | "asystole"
  | "pea"
  | "heart_block"
  | "unknown";

type Props = {
  rhythmSummary?: string;
  hr?: number;
  className?: string;
  height?: number;
  showLabel?: boolean;
  onRhythmChange?: (newRhythm: string) => void;
};

function detectRhythmType(summary?: string): RhythmType {
  if (!summary) return "sinus";
  const s = summary.toLowerCase();
  if (s.includes("vfib") || s.includes("ventricular fibrillation")) return "vfib";
  if (s.includes("vtach") || s.includes("ventricular tachycardia")) return "vtach";
  if (s.includes("svt") || s.includes("supraventricular")) return "svt";
  if (s.includes("afib") || s.includes("atrial fibrillation") || s.includes("a-fib")) return "afib";
  if (s.includes("asystole") || s.includes("flatline")) return "asystole";
  if (s.includes("pea") || s.includes("pulseless electrical")) return "pea";
  if (s.includes("heart block") || s.includes("av block") || s.includes("3rd degree")) return "heart_block";
  if (s.includes("bradycardia") || s.includes("brady")) return "sinus_bradycardia";
  if (s.includes("tachycardia") || s.includes("tachy")) return "sinus_tachycardia";
  if (s.includes("sinus") || s.includes("nsr") || s.includes("normal")) return "sinus";
  return "unknown";
}

function generateQRSComplex(phase: number, amplitude: number): number {
  // P wave (small bump before QRS)
  if (phase >= 0.0 && phase < 0.08) {
    const t = (phase - 0.04) / 0.04;
    return amplitude * 0.15 * Math.exp(-t * t * 8);
  }
  // PR segment (flat)
  if (phase >= 0.08 && phase < 0.12) return 0;
  // Q wave (small dip)
  if (phase >= 0.12 && phase < 0.14) {
    return amplitude * -0.1 * Math.sin((phase - 0.12) / 0.02 * Math.PI);
  }
  // R wave (tall spike)
  if (phase >= 0.14 && phase < 0.18) {
    const t = (phase - 0.16) / 0.02;
    return amplitude * 1.0 * Math.exp(-t * t * 12);
  }
  // S wave (dip after R)
  if (phase >= 0.18 && phase < 0.22) {
    return amplitude * -0.25 * Math.sin((phase - 0.18) / 0.04 * Math.PI);
  }
  // ST segment (flat or slightly elevated)
  if (phase >= 0.22 && phase < 0.32) return amplitude * 0.02;
  // T wave (rounded bump)
  if (phase >= 0.32 && phase < 0.48) {
    const t = (phase - 0.40) / 0.08;
    return amplitude * 0.3 * Math.exp(-t * t * 6);
  }
  return 0;
}

function generateRhythmSample(
  rhythmType: RhythmType,
  time: number,
  hr: number,
  irregularityOffset: number
): number {
  const msPerBeat = 60000 / Math.max(30, Math.min(300, hr));
  const noise = (Math.random() - 0.5) * 0.02;

  switch (rhythmType) {
    case "sinus":
    case "sinus_tachycardia":
    case "sinus_bradycardia": {
      const phase = ((time % msPerBeat) / msPerBeat);
      return generateQRSComplex(phase, 0.8) + noise;
    }

    case "svt": {
      // Very fast, narrow QRS complexes
      const fastMsPerBeat = msPerBeat * 0.5; // SVT is faster
      const phase = ((time % fastMsPerBeat) / fastMsPerBeat);
      // Narrow QRS, no discernible P waves
      if (phase >= 0.1 && phase < 0.2) {
        const t = (phase - 0.15) / 0.05;
        return 0.9 * Math.exp(-t * t * 20) + noise;
      }
      return noise * 0.5;
    }

    case "vtach": {
      // Wide, bizarre QRS complexes, regular
      const phase = ((time % msPerBeat) / msPerBeat);
      // Wide QRS complex (monomorphic VT)
      if (phase < 0.35) {
        const t = (phase - 0.175) / 0.175;
        const wide = Math.sin(t * Math.PI * 1.5) * 0.9;
        return wide + noise;
      }
      return noise * 0.3;
    }

    case "vfib": {
      // Chaotic, no discernible pattern
      const chaos = Math.sin(time * 0.05) * 0.4 +
        Math.sin(time * 0.08 + 1) * 0.3 +
        Math.sin(time * 0.12 + 2) * 0.2 +
        Math.sin(time * 0.03) * 0.2;
      return chaos + (Math.random() - 0.5) * 0.3;
    }

    case "afib": {
      // Irregularly irregular, fibrillatory baseline
      const irregularBeat = msPerBeat * (0.7 + irregularityOffset * 0.6);
      const phase = ((time % irregularBeat) / irregularBeat);
      const fibrillation = Math.sin(time * 0.4) * 0.05 + Math.sin(time * 0.6) * 0.03;
      if (phase >= 0.12 && phase < 0.2) {
        const t = (phase - 0.16) / 0.04;
        return 0.85 * Math.exp(-t * t * 15) + fibrillation + noise;
      }
      return fibrillation + noise * 0.5;
    }

    case "asystole": {
      // Flatline with occasional artifact
      return noise * 0.3;
    }

    case "pea": {
      // Organized electrical activity but slower/weaker looking
      const slowMsPerBeat = msPerBeat * 1.5;
      const phase = ((time % slowMsPerBeat) / slowMsPerBeat);
      return generateQRSComplex(phase, 0.5) + noise;
    }

    case "heart_block": {
      // P waves marching through, occasional dropped QRS
      const pWavePeriod = msPerBeat * 0.8;
      const qrsPeriod = msPerBeat * 2; // Slower ventricular rate
      const pPhase = ((time % pWavePeriod) / pWavePeriod);
      const qrsPhase = ((time % qrsPeriod) / qrsPeriod);

      // P waves
      let pWave = 0;
      if (pPhase >= 0.0 && pPhase < 0.15) {
        const t = (pPhase - 0.075) / 0.075;
        pWave = 0.2 * Math.exp(-t * t * 6);
      }

      // QRS (at slower rate)
      let qrs = 0;
      if (qrsPhase >= 0.1 && qrsPhase < 0.2) {
        const t = (qrsPhase - 0.15) / 0.05;
        qrs = 0.8 * Math.exp(-t * t * 12);
      }

      return pWave + qrs + noise;
    }

    default: {
      const phase = ((time % msPerBeat) / msPerBeat);
      return generateQRSComplex(phase, 0.7) + noise;
    }
  }
}

export function RhythmWaveform({
  rhythmSummary,
  hr = 80,
  className = "",
  height = 64,
  showLabel = true,
  onRhythmChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const bufferRef = useRef<number[]>([]);
  const lastRhythmRef = useRef<string | undefined>(undefined);
  const [isFlashing, setIsFlashing] = useState(false);
  const irregularityRef = useRef(Math.random());

  const rhythmType = useMemo(() => detectRhythmType(rhythmSummary), [rhythmSummary]);
  const width = 300;
  const bufferSize = width;

  // Detect rhythm changes and trigger flash
  useEffect(() => {
    if (rhythmSummary && rhythmSummary !== lastRhythmRef.current) {
      if (lastRhythmRef.current !== undefined) {
        setIsFlashing(true);
        onRhythmChange?.(rhythmSummary);
        setTimeout(() => setIsFlashing(false), 1500);
      }
      lastRhythmRef.current = rhythmSummary;
      // Update irregularity for afib
      irregularityRef.current = Math.random();
    }
  }, [rhythmSummary, onRhythmChange]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const sample = generateRhythmSample(rhythmType, now, hr, irregularityRef.current);

    // Update buffer
    bufferRef.current.push(sample);
    if (bufferRef.current.length > bufferSize) {
      bufferRef.current.shift();
    }

    // Clear canvas
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#1e293b33"; // slate-800 with opacity
    ctx.lineWidth = 1;
    for (let y = height / 4; y < height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveform
    const buffer = bufferRef.current;
    if (buffer.length < 2) {
      animationRef.current = requestAnimationFrame(draw);
      return;
    }

    // Waveform color based on rhythm type
    let strokeColor = "#22d3ee"; // cyan-400 (default)
    if (rhythmType === "vfib" || rhythmType === "asystole") {
      strokeColor = "#f87171"; // red-400
    } else if (rhythmType === "vtach" || rhythmType === "svt") {
      strokeColor = "#fbbf24"; // amber-400
    } else if (rhythmType === "afib") {
      strokeColor = "#f97316"; // orange-500
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const centerY = height / 2;
    const scale = height * 0.4;

    for (let i = 0; i < buffer.length; i++) {
      const x = (i / bufferSize) * width;
      const y = centerY - buffer[i] * scale;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw glow effect for critical rhythms
    if (rhythmType === "vfib" || rhythmType === "asystole" || rhythmType === "vtach") {
      ctx.strokeStyle = `${strokeColor}40`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < buffer.length; i++) {
        const x = (i / bufferSize) * width;
        const y = centerY - buffer[i] * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [rhythmType, hr, width, height, bufferSize]);

  useEffect(() => {
    // Initialize buffer
    bufferRef.current = new Array(bufferSize).fill(0);
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, bufferSize]);

  const rhythmLabel = useMemo(() => {
    switch (rhythmType) {
      case "sinus": return "Sinus Rhythm";
      case "sinus_tachycardia": return "Sinus Tachycardia";
      case "sinus_bradycardia": return "Sinus Bradycardia";
      case "svt": return "SVT";
      case "vtach": return "V-Tach";
      case "vfib": return "V-Fib";
      case "afib": return "A-Fib";
      case "asystole": return "Asystole";
      case "pea": return "PEA";
      case "heart_block": return "Heart Block";
      default: return rhythmSummary || "Unknown";
    }
  }, [rhythmType, rhythmSummary]);

  const isCritical = rhythmType === "vfib" || rhythmType === "asystole" || rhythmType === "vtach";

  return (
    <div
      className={`relative rounded-lg overflow-hidden ${className} ${
        isFlashing ? "animate-rhythm-flash" : ""
      } ${isCritical ? "ring-2 ring-red-500/60" : ""}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      {showLabel && (
        <div className="absolute top-1 left-2 flex items-center gap-2">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              isCritical
                ? "bg-red-500/30 text-red-200 animate-pulse"
                : rhythmType === "svt" || rhythmType === "afib"
                ? "bg-amber-500/30 text-amber-200"
                : "bg-emerald-500/20 text-emerald-200"
            }`}
          >
            {rhythmLabel}
          </span>
          {hr && (
            <span className="text-[10px] text-slate-400">
              {hr} bpm
            </span>
          )}
        </div>
      )}
      {isFlashing && (
        <div className="absolute inset-0 bg-amber-400/20 pointer-events-none animate-pulse" />
      )}
    </div>
  );
}

export function RhythmWaveformMini({
  rhythmSummary,
  hr = 80,
  className = "",
}: Pick<Props, "rhythmSummary" | "hr" | "className">) {
  return (
    <RhythmWaveform
      rhythmSummary={rhythmSummary}
      hr={hr}
      className={className}
      height={40}
      showLabel={false}
    />
  );
}
