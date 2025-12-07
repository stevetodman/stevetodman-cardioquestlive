import { logSimEvent } from "./persistence";
import { SessionManager } from "./sessionManager";
import { Runtime } from "./typesRuntime";

export function buildTelemetryWaveform(hr: number): number[] {
  const samples = 180;
  const waveform: number[] = [];
  const msPerBeat = Math.max(350, Math.min(1500, 60000 / Math.max(1, hr)));
  for (let i = 0; i < samples; i++) {
    const tMs = (i / samples) * msPerBeat * 1.5;
    const phase = (tMs % msPerBeat) / msPerBeat;
    const spike = phase < 0.04 ? Math.exp(-1 * (((phase - 0.02) * 160) ** 2)) * 1.4 : 0;
    const base = 0.04 * Math.sin(phase * Math.PI * 2);
    const noise = (Math.random() - 0.5) * 0.015;
    waveform.push(base + spike + noise);
  }
  return waveform;
}

type AlarmSeen = {
  spo2Low?: number;
  hrHigh?: number;
  hrLow?: number;
};

export function checkAlarms(
  sessionId: string,
  runtime: Runtime,
  alarmSeenAt: Map<string, AlarmSeen>,
  sessionManager: SessionManager
) {
  const vitals = runtime.scenarioEngine.getState().vitals || {};
  const spo2 = vitals.spo2 ?? 100;
  const hr = vitals.hr ?? 80;
  const alarms: string[] = [];
  const now = Date.now();
  const seen = alarmSeenAt.get(sessionId) ?? {};
  if (spo2 < 88) {
    seen.spo2Low = seen.spo2Low ?? now;
    if (now - seen.spo2Low >= 4000) alarms.push(`SpO2 low: ${spo2}%`);
  } else {
    seen.spo2Low = undefined;
  }
  if (hr > 170) {
    seen.hrHigh = seen.hrHigh ?? now;
    if (now - seen.hrHigh >= 4000) alarms.push(`HR high: ${hr} bpm`);
  } else {
    seen.hrHigh = undefined;
  }
  if (hr < 40) {
    seen.hrLow = seen.hrLow ?? now;
    if (now - seen.hrLow >= 4000) alarms.push(`HR low: ${hr} bpm`);
  } else {
    seen.hrLow = undefined;
  }
  alarmSeenAt.set(sessionId, seen);
  if (alarms.length === 0) return;
  sessionManager.broadcastToPresenters(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text: `ALARM: ${alarms.join(" | ")}`,
    character: "nurse",
  });
  logSimEvent(sessionId, { type: "alarm", payload: { alarms } }).catch(() => {});
}
