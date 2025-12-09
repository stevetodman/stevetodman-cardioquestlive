import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVitalsChange } from "../hooks/useVitalsChange";

type Vitals = { hr?: number; bp?: string; rr?: number; spo2?: number; temp?: number };

type Props = {
  vitals: Vitals;
  telemetryWaveform?: number[];
  telemetryOn?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clampSpo2 = (v?: number) => (typeof v === "number" ? Math.min(100, v) : undefined);

export function VitalsMonitor({ vitals, telemetryWaveform, telemetryOn }: Props) {
  const [display, setDisplay] = useState<Vitals>({});
  const lastTarget = useRef<Vitals>({});
  const highlightedVitals = useVitalsChange(vitals);

  useEffect(() => {
    lastTarget.current = vitals;
    const start = performance.now();
    const duration = 900; // ms tween
    const initial = display;
    const anim = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const lerpNum = (a?: number, b?: number) => {
        if (typeof a !== "number") return b;
        if (typeof b !== "number") return a;
        return a + (b - a) * t;
      };
      setDisplay({
        hr: Math.round(lerpNum(initial.hr, vitals.hr) ?? 0) || undefined,
        rr: Math.round(lerpNum(initial.rr, vitals.rr) ?? 0) || undefined,
        spo2: clampSpo2(Math.round(lerpNum(initial.spo2, vitals.spo2) ?? 0) || undefined),
        temp: lerpNum(initial.temp, vitals.temp) ?? undefined,
        bp: vitals.bp ?? initial.bp,
      });
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitals.hr, vitals.rr, vitals.spo2, vitals.temp, vitals.bp]);

  const waveformPath = useMemo(() => {
    if (!telemetryWaveform || telemetryWaveform.length === 0) return null;
    const h = 60;
    const pts = telemetryWaveform
      .map((v, i) => `${i},${h / 2 - clamp(v * 40, -h / 2 + 2, h / 2 - 2)}`)
      .join(" ");
    return { pts, width: telemetryWaveform.length, height: h };
  }, [telemetryWaveform]);

  return (
    <div className="bg-black text-emerald-100 rounded-xl border border-emerald-700/40 shadow-lg p-3 space-y-2">
      <div className="flex justify-between items-center text-[11px] uppercase tracking-[0.16em] text-emerald-300">
        <span>Vitals Monitor</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${telemetryOn ? "bg-emerald-500/20" : "bg-slate-700/60"}`}>
          {telemetryOn ? "Telemetry On" : "Telemetry Off"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <VitalTile label="HR" value={display.hr ?? "—"} unit="bpm" highlight isChanging={highlightedVitals.has("hr")} />
        <VitalTile label="BP" value={display.bp ?? "—"} unit="" isChanging={highlightedVitals.has("bp")} />
        <VitalTile label="SpO₂" value={display.spo2 ?? "—"} unit="%" isChanging={highlightedVitals.has("spo2")} />
        <VitalTile label="RR" value={display.rr ?? "—"} unit="" isChanging={highlightedVitals.has("rr")} />
        <VitalTile label="Temp" value={display.temp ? display.temp.toFixed(1) : "—"} unit="°C" isChanging={highlightedVitals.has("temp")} />
      </div>
      {waveformPath && (
        <div className="bg-slate-900 rounded-lg border border-emerald-800/50 p-2">
          <svg viewBox={`0 0 ${waveformPath.width} ${waveformPath.height}`} className="w-full h-16">
            <polyline fill="none" stroke="#22d3ee" strokeWidth="2" points={waveformPath.pts} />
          </svg>
        </div>
      )}
    </div>
  );
}

function VitalTile({
  label,
  value,
  unit,
  highlight,
  isChanging,
}: {
  label: string;
  value: string | number;
  unit: string;
  highlight?: boolean;
  isChanging?: boolean;
}) {
  const baseClass = highlight ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-900";
  const animationClass = isChanging ? "animate-vital-highlight" : "";

  return (
    <div className={`rounded-lg border px-2 py-1 ${baseClass} ${animationClass}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">{label}</div>
      <div className="text-xl font-semibold text-emerald-100">
        {value}
        {unit && <span className="text-sm ml-1 text-emerald-300">{unit}</span>}
      </div>
    </div>
  );
}
