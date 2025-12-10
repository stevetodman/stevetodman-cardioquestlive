import React, { useMemo, useState } from "react";

// Timeline event types
export type TimelineEventType = "order" | "treatment" | "ekg" | "stage" | "finding";

export interface TimelineEvent {
  id: string;
  ts: number;
  type: TimelineEventType;
  label: string;
  detail?: string;
  icon?: string;
}

interface CaseTimelineProps {
  orders?: { id: string; type: string; status: string; result?: any; completedAt?: number }[];
  treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
  ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
  scenarioStartedAt?: number;
  compact?: boolean;
  maxEvents?: number;
}

// Format relative time (e.g., "2m ago", "Just now")
function formatRelativeTime(ts: number, startedAt?: number): string {
  const base = startedAt ?? ts;
  const elapsed = Math.floor((ts - base) / 1000);

  if (elapsed < 60) return startedAt ? `+${elapsed}s` : "Just now";
  if (elapsed < 3600) return `+${Math.floor(elapsed / 60)}m`;
  return `+${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
}

// Get icon for event type
function getEventIcon(type: TimelineEventType, subtype?: string): string {
  switch (type) {
    case "order":
      if (subtype === "ekg") return "📈";
      if (subtype === "vitals") return "💓";
      if (subtype === "labs") return "🧪";
      if (subtype === "imaging") return "🩻";
      if (subtype?.includes("exam")) return "🩺";
      return "📋";
    case "treatment":
      if (subtype?.includes("oxygen") || subtype?.includes("o2")) return "💨";
      if (subtype?.includes("iv") || subtype?.includes("fluid") || subtype?.includes("bolus")) return "💉";
      if (subtype?.includes("defib") || subtype?.includes("cardioversion")) return "⚡";
      if (subtype?.includes("adenosine")) return "💊";
      if (subtype?.includes("epinephrine") || subtype?.includes("epi")) return "💉";
      return "💊";
    case "ekg":
      return "📈";
    case "stage":
      return "📍";
    case "finding":
      return "🔍";
    default:
      return "•";
  }
}

// Get color class for event type
function getEventColor(type: TimelineEventType): string {
  switch (type) {
    case "order":
      return "text-sky-400 border-sky-500/30 bg-sky-500/10";
    case "treatment":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    case "ekg":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "stage":
      return "text-violet-400 border-violet-500/30 bg-violet-500/10";
    case "finding":
      return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    default:
      return "text-slate-400 border-slate-500/30 bg-slate-500/10";
  }
}

// Format order type for display
function formatOrderType(type: string): string {
  switch (type) {
    case "vitals": return "Vitals check";
    case "ekg": return "EKG ordered";
    case "labs": return "Labs ordered";
    case "imaging": return "Imaging ordered";
    case "cardiac_exam": return "Cardiac exam";
    case "lung_exam": return "Lung exam";
    case "general_exam": return "General exam";
    default: return type.replace(/_/g, " ");
  }
}

// Format treatment type for display
function formatTreatmentType(treatmentType: string): string {
  // Handle character prefix like "[nurse] IV placed"
  const cleaned = treatmentType.replace(/^\[[^\]]+\]\s*/, "");
  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function CaseTimeline({
  orders = [],
  treatmentHistory = [],
  ekgHistory = [],
  scenarioStartedAt,
  compact = false,
  maxEvents = 10,
}: CaseTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Merge all events into a single sorted timeline
  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = [];

    // Add completed orders
    orders
      .filter(o => o.status === "complete" && o.completedAt)
      .forEach(o => {
        all.push({
          id: `order-${o.id}`,
          ts: o.completedAt!,
          type: "order",
          label: formatOrderType(o.type),
          detail: o.result?.summary,
          icon: getEventIcon("order", o.type),
        });
      });

    // Add treatments
    treatmentHistory.forEach((t, i) => {
      all.push({
        id: `treatment-${i}-${t.ts}`,
        ts: t.ts,
        type: "treatment",
        label: formatTreatmentType(t.treatmentType),
        detail: t.note,
        icon: getEventIcon("treatment", t.treatmentType.toLowerCase()),
      });
    });

    // Add EKGs
    ekgHistory.forEach((e, i) => {
      all.push({
        id: `ekg-${i}-${e.ts}`,
        ts: e.ts,
        type: "ekg",
        label: "EKG result",
        detail: e.summary,
        icon: getEventIcon("ekg"),
      });
    });

    // Sort by timestamp descending (newest first)
    return all.sort((a, b) => b.ts - a.ts);
  }, [orders, treatmentHistory, ekgHistory]);

  const displayEvents = isExpanded ? events : events.slice(0, maxEvents);
  const hasMore = events.length > maxEvents;

  if (events.length === 0) {
    return null;
  }

  return (
    <div className={`bg-slate-900/60 border border-slate-700 rounded-lg ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Case Timeline
        </h3>
        <span className="text-[9px] text-slate-500">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1.5">
        {displayEvents.map((event, index) => (
          <div
            key={event.id}
            className={`flex items-start gap-2 ${compact ? "text-[10px]" : "text-xs"}`}
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-full border ${getEventColor(event.type)} text-[10px]`}
              >
                {event.icon}
              </span>
              {index < displayEvents.length - 1 && (
                <div className="w-px h-3 bg-slate-700 my-0.5" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-200 font-medium truncate">
                  {event.label}
                </span>
                <span className="text-slate-500 text-[9px] shrink-0">
                  {formatRelativeTime(event.ts, scenarioStartedAt)}
                </span>
              </div>
              {event.detail && !compact && (
                <p className="text-slate-400 text-[10px] truncate mt-0.5">
                  {event.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
        >
          {isExpanded ? "Show less" : `Show ${events.length - maxEvents} more`}
        </button>
      )}
    </div>
  );
}
