/**
 * usePresenterTimeline - Handles timeline-related computations and actions.
 * Extracted from PresenterSession to reduce component complexity.
 */
import { useMemo, useCallback } from "react";
import { collection, addDoc, db } from "../utils/firestore";
import { auth } from "../firebase";
import { useSimulation, useDebrief, type TranscriptLogTurn, type SimState } from "../contexts";
import { ROLE_COLORS } from "../types/voiceGateway";

export interface TimelineItem {
  id: string;
  ts: number;
  label: string;
  detail: string;
}

interface UsePresenterTimelineReturn {
  timelineItems: TimelineItem[];
  filteredTimeline: TimelineItem[];
  timelineText: string;
  timelineBadge: (label: string) => string;
  saveTimelineToSession: () => Promise<void>;
  saveTranscriptToSession: () => Promise<void>;
  transcriptText: string;
}

export function usePresenterTimeline(sessionId: string | undefined): UsePresenterTimelineReturn {
  const { simState, transcriptLog } = useSimulation();
  const {
    timelineExtras,
    timelineFilter,
    timelineSearch,
    setTimelineSaveStatus,
    setTranscriptSaveStatus,
  } = useDebrief();

  // Build EKG history from orders or ekgHistory field
  const ekgHistory = useMemo(() => {
    if ((simState as any)?.ekgHistory) return (simState as any).ekgHistory;
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.slice(-3).reverse();
  }, [simState?.orders, (simState as any)?.ekgHistory]);

  // Build timeline items from various sources
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add transcript turns
    transcriptLog.forEach((t) => {
      items.push({
        id: `turn-${t.id}`,
        ts: t.timestamp,
        label: t.character ? String(t.character) : t.role === "doctor" ? "Doctor" : "Patient",
        detail: t.text,
      });
    });

    // Add telemetry history
    (simState?.telemetryHistory ?? []).forEach((h, idx) => {
      items.push({
        id: `telemetry-${idx}-${h.ts ?? Date.now()}`,
        ts: h.ts ?? Date.now(),
        label: "Telemetry",
        detail: h.rhythm ?? "Rhythm update",
      });
    });

    // Add EKG history
    (ekgHistory ?? []).forEach((ekg: any, idx: number) => {
      items.push({
        id: `ekg-${idx}-${ekg.ts ?? Date.now()}`,
        ts: ekg.ts ?? Date.now(),
        label: "EKG",
        detail: ekg.summary ?? "EKG",
      });
    });

    // Add completed orders
    (simState?.orders ?? [])
      .filter((o) => o.status === "complete")
      .forEach((o) => {
        items.push({
          id: `order-${o.id}`,
          ts: o.completedAt ?? Date.now(),
          label: o.type.toUpperCase(),
          detail:
            o.result?.type === "vitals"
              ? `HR ${(o.result as any).hr ?? "—"} BP ${(o.result as any).bp ?? "—"} SpO₂ ${(o.result as any).spo2 ?? "—"}`
              : (o.result as any)?.summary ?? "Result ready",
        });
      });

    // Add treatment history
    (simState?.treatmentHistory ?? []).forEach((th, idx) => {
      items.push({
        id: `treatment-${idx}-${th.ts ?? Date.now()}`,
        ts: th.ts ?? Date.now(),
        label: "Treatment",
        detail: `${th.treatmentType}${th.note ? `: ${th.note}` : ""}`,
      });
    });

    // Add exam if present
    if (simState?.exam && Object.values(simState.exam).some((v) => v)) {
      items.push({
        id: `exam-${simState.stageId}-${Date.now()}`,
        ts: Date.now(),
        label: "Exam",
        detail: [
          simState.exam.general && `General: ${simState.exam.general}`,
          simState.exam.cardio && `CV: ${simState.exam.cardio}`,
          simState.exam.lungs && `Lungs: ${simState.exam.lungs}`,
          simState.exam.perfusion && `Perfusion: ${simState.exam.perfusion}`,
          simState.exam.neuro && `Neuro: ${simState.exam.neuro}`,
        ]
          .filter(Boolean)
          .join(" | "),
      });
    }

    // Add extras
    timelineExtras.forEach((extra) => items.push(extra));

    // Sort, dedupe, and limit
    return items
      .sort((a, b) => a.ts - b.ts)
      .filter((item, idx, arr) => arr.findIndex((it) => it.id === item.id) === idx)
      .slice(-20);
  }, [transcriptLog, simState, ekgHistory, timelineExtras]);

  // Filter timeline based on filter and search
  const filteredTimeline = useMemo(
    () =>
      (timelineFilter === "all"
        ? timelineItems
        : timelineItems.filter((item) => item.label.toLowerCase() === timelineFilter)
      ).filter((item) =>
        timelineSearch
          ? `${item.label} ${item.detail}`.toLowerCase().includes(timelineSearch.toLowerCase())
          : true
      ),
    [timelineItems, timelineFilter, timelineSearch]
  );

  // Format timeline as text
  const timelineText = useMemo(() => {
    return timelineItems
      .map((item) => {
        const ts = new Date(item.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        return `${ts} ${item.label}: ${item.detail}`;
      })
      .join("\n");
  }, [timelineItems]);

  // Format transcript as text
  const transcriptText = useMemo(() => {
    const parts: string[] = [];

    transcriptLog.forEach((t) => {
      const ts = new Date(t.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const speaker = t.character ?? t.role ?? "unknown";
      parts.push(`${ts} ${speaker}: ${t.text}`);
    });

    (simState?.treatmentHistory ?? []).forEach((th) => {
      const ts = th.ts
        ? new Date(th.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "";
      parts.push(`${ts} Treatment: ${th.treatmentType}${th.note ? ` (${th.note})` : ""}`);
    });

    (simState?.telemetryHistory ?? []).forEach((h) => {
      const ts = h.ts
        ? new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "";
      parts.push(`${ts} Telemetry: ${h.rhythm ?? "update"}${h.note ? ` (${h.note})` : ""}`);
    });

    (simState?.ekgHistory ?? []).forEach((e) => {
      const ts = e.ts
        ? new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "";
      parts.push(`${ts} EKG: ${e.summary ?? "strip"}`);
    });

    const vitalsTrend = (simState?.vitalsHistory as any[]) ?? [];
    vitalsTrend.slice(-5).forEach((v, idx) => {
      const ts = v.ts
        ? new Date(v.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : `vitals-${idx}`;
      parts.push(`${ts} Vitals: HR ${v.hr ?? "—"} BP ${v.bp ?? "—"} SpO2 ${v.spo2 ?? "—"}`);
    });

    return parts.join("\n");
  }, [transcriptLog, simState]);

  // Badge styling helper
  const timelineBadge = useCallback((label: string) => {
    const lowered = label.toLowerCase();
    const colors = ROLE_COLORS[lowered as keyof typeof ROLE_COLORS];
    if (colors) {
      return `${colors.border} ${colors.text} px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.14em]`;
    }
    return "px-2 py-0.5 rounded border border-slate-700 text-[10px] uppercase tracking-[0.14em] text-slate-200";
  }, []);

  // Save timeline to Firestore
  const saveTimelineToSession = useCallback(async () => {
    if (!sessionId || !timelineText || timelineItems.length === 0) return;
    setTimelineSaveStatus("saving");
    try {
      const tlCollection = collection(db, "sessions", sessionId, "timeline");
      await addDoc(tlCollection, {
        createdBy: auth.currentUser?.uid ?? "unknown",
        createdAt: new Date().toISOString(),
        text: timelineText,
      });
      setTimelineSaveStatus("saved");
      setTimeout(() => setTimelineSaveStatus("idle"), 1500);
    } catch {
      setTimelineSaveStatus("error");
      setTimeout(() => setTimelineSaveStatus("idle"), 1500);
    }
  }, [sessionId, timelineItems.length, timelineText, setTimelineSaveStatus]);

  // Save transcript to Firestore
  const saveTranscriptToSession = useCallback(async () => {
    if (!sessionId || !transcriptText || transcriptLog.length === 0) return;
    setTranscriptSaveStatus("saving");
    try {
      const trCollection = collection(db, "sessions", sessionId, "transcripts");
      await addDoc(trCollection, {
        createdBy: auth.currentUser?.uid ?? "unknown",
        createdAt: new Date().toISOString(),
        text: transcriptText,
      });
      setTranscriptSaveStatus("saved");
      setTimeout(() => setTranscriptSaveStatus("idle"), 1500);
    } catch {
      setTranscriptSaveStatus("error");
      setTimeout(() => setTranscriptSaveStatus("idle"), 1500);
    }
  }, [sessionId, transcriptLog.length, transcriptText, setTranscriptSaveStatus]);

  return {
    timelineItems,
    filteredTimeline,
    timelineText,
    timelineBadge,
    saveTimelineToSession,
    saveTranscriptToSession,
    transcriptText,
  };
}
