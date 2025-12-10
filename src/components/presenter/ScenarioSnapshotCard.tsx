/**
 * Scenario snapshot card for presenter view.
 * Displays patient snapshot with chief complaint, HPI, exam, labs, and imaging.
 */

import React from "react";

export interface ScenarioSnapshot {
  chiefComplaint: string;
  hpi: string[];
  exam: string[];
  labs: { name: string; status: "pending" | "result"; summary: string }[];
  imaging: { name: string; status: "pending" | "result"; summary: string }[];
}

export interface ScenarioSnapshotCardProps {
  snapshot: ScenarioSnapshot | null;
}

export function ScenarioSnapshotCard({ snapshot }: ScenarioSnapshotCardProps) {
  if (!snapshot) return null;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-3 shadow-sm shadow-black/30">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-1">
        Patient snapshot
      </div>
      <div className="text-sm font-semibold text-slate-50 mb-3">{snapshot.chiefComplaint}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <SnapshotSection title="HPI highlights" items={snapshot.hpi} />
        <SnapshotSection title="Exam" items={snapshot.exam} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 mt-3">
        <ResultSection title="Labs" items={snapshot.labs} />
        <ResultSection title="Imaging" items={snapshot.imaging} />
      </div>
    </div>
  );
}

function SnapshotSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{title}</div>
      <ul className="text-sm text-slate-200 space-y-1 list-disc list-inside">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

interface ResultItem {
  name: string;
  status: "pending" | "result";
  summary: string;
}

function ResultSection({ title, items }: { title: string; items: ResultItem[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{title}</div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-slate-200 flex items-start gap-2">
            <StatusBadge status={item.status} />
            <div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-slate-400 text-[13px] leading-tight">{item.summary}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "result" }) {
  const classes =
    status === "result"
      ? "bg-emerald-500/15 text-emerald-100 border-emerald-500/50"
      : "bg-slate-800 text-slate-200 border-slate-700";

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[11px] ${classes}`}>
      {status === "result" ? "result" : "pending"}
    </span>
  );
}
