/**
 * useTimelineBuilder - Builds and filters timeline items for session display.
 * Extracted from PresenterSession.tsx for better maintainability.
 *
 * Handles:
 * - Building timeline from transcript, orders, telemetry, EKGs, treatments
 * - Filtering timeline by type and search query
 * - Generating timeline text for exports/clipboard
 */

import { useMemo } from "react";
import { TranscriptLogTurn } from "../components/SessionTranscriptPanel";

export type TimelineItem = {
  id: string;
  ts: number;
  label: string;
  detail: string;
};

export type TimelineExtra = {
  id: string;
  ts: number;
  label: string;
  detail: string;
};

export type SimStateForTimeline = {
  stageId?: string;
  orders?: Array<{
    id: string;
    type: string;
    status: string;
    completedAt?: number;
    result?: {
      type?: string;
      hr?: number;
      bp?: string;
      spo2?: number;
      summary?: string;
    };
  }>;
  telemetryHistory?: Array<{
    ts?: number;
    rhythm?: string;
    note?: string;
  }>;
  treatmentHistory?: Array<{
    ts?: number;
    treatmentType: string;
    note?: string;
  }>;
  ekgHistory?: Array<{
    ts?: number;
    summary?: string;
    imageUrl?: string;
    completedAt?: number;
    result?: { summary?: string };
  }>;
  vitalsHistory?: Array<{
    ts?: number;
    hr?: number;
    bp?: string;
    spo2?: number;
  }>;
  exam?: Record<string, string | undefined>;
};

export type UseTimelineBuilderOptions = {
  transcriptLog: TranscriptLogTurn[];
  simState: SimStateForTimeline | null;
  timelineExtras: TimelineExtra[];
  timelineFilter: string;
  timelineSearch: string;
};

export type UseTimelineBuilderResult = {
  timelineItems: TimelineItem[];
  filteredTimeline: TimelineItem[];
  timelineText: string;
};

export function useTimelineBuilder(
  options: UseTimelineBuilderOptions
): UseTimelineBuilderResult {
  const { transcriptLog, simState, timelineExtras, timelineFilter, timelineSearch } =
    options;

  // Build the raw timeline from all sources
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Transcript turns
    transcriptLog.forEach((t) => {
      items.push({
        id: `turn-${t.id}`,
        ts: t.timestamp,
        label: t.character ? t.character : t.role === "doctor" ? "Doctor" : "Patient",
        detail: t.text,
      });
    });

    // Telemetry history
    (simState?.telemetryHistory ?? []).forEach((h, idx) => {
      items.push({
        id: `telemetry-${idx}-${h.ts ?? Date.now()}`,
        ts: h.ts ?? Date.now(),
        label: "Telemetry",
        detail: h.rhythm ?? "Rhythm update",
      });
    });

    // EKG history
    const ekgHistory = simState?.ekgHistory ?? [];
    ekgHistory.forEach((ekg, idx) => {
      items.push({
        id: `ekg-${idx}-${ekg.ts ?? Date.now()}`,
        ts: ekg.ts ?? Date.now(),
        label: "EKG",
        detail: ekg.summary ?? "EKG",
      });
    });

    // Completed orders
    (simState?.orders ?? [])
      .filter((o) => o.status === "complete")
      .forEach((o) => {
        items.push({
          id: `order-${o.id}`,
          ts: o.completedAt ?? Date.now(),
          label: o.type.toUpperCase(),
          detail:
            o.result?.type === "vitals"
              ? `HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`
              : o.result?.summary ?? "Result ready",
        });
      });

    // Treatment history
    (simState?.treatmentHistory ?? []).forEach((th, idx) => {
      items.push({
        id: `treatment-${idx}-${th.ts ?? Date.now()}`,
        ts: th.ts ?? Date.now(),
        label: "Treatment",
        detail: `${th.treatmentType}${th.note ? `: ${th.note}` : ""}`,
      });
    });

    // Exam findings (if any)
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

    // Extra timeline entries (NPC interjections, assessments, etc.)
    timelineExtras.forEach((extra) => items.push(extra));

    // Sort by timestamp, deduplicate, and limit to last 20
    return items
      .sort((a, b) => a.ts - b.ts)
      .filter((item, idx, arr) => arr.findIndex((it) => it.id === item.id) === idx)
      .slice(-20);
  }, [transcriptLog, simState?.orders, simState?.telemetryHistory, simState?.treatmentHistory, simState?.ekgHistory, simState?.exam, simState?.stageId, timelineExtras]);

  // Filter timeline by type and search
  const filteredTimeline = useMemo(
    () =>
      (timelineFilter === "all"
        ? timelineItems
        : timelineItems.filter(
            (item) => item.label.toLowerCase() === timelineFilter
          )
      ).filter((item) =>
        timelineSearch
          ? `${item.label} ${item.detail}`
              .toLowerCase()
              .includes(timelineSearch.toLowerCase())
          : true
      ),
    [timelineItems, timelineFilter, timelineSearch]
  );

  // Generate text representation for exports
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

  return {
    timelineItems,
    filteredTimeline,
    timelineText,
  };
}
