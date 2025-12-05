import React from "react";
import { AnalysisResult } from "../types/voiceGateway";

type DebriefPanelProps = {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  onGenerate: () => void;
  disabled?: boolean;
};

export function DebriefPanel({ result, isAnalyzing, onGenerate, disabled }: DebriefPanelProps) {
  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm shadow-black/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Debrief (Presenter)
          </div>
          <div className="text-xs text-slate-500">AI summary for teaching/debrief</div>
        </div>
        <button
          type="button"
          disabled={disabled || isAnalyzing}
          onClick={onGenerate}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
            disabled || isAnalyzing
              ? "border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed"
              : "border-emerald-600/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-500"
          }`}
        >
          {isAnalyzing ? "Analyzing…" : "Generate debrief"}
        </button>
      </div>
      {isAnalyzing && <div className="text-xs text-slate-400">Analyzing transcript…</div>}
      {result && (
        <div className="space-y-3 text-sm text-slate-100">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1">
              Summary
            </div>
            <div className="leading-snug text-slate-100">{result.summary || "—"}</div>
          </div>
          <Section title="Strengths" items={result.strengths} />
          <Section title="Opportunities" items={result.opportunities} />
          <Section title="Teaching points" items={result.teachingPoints} />
        </div>
      )}
      {!isAnalyzing && !result && (
        <div className="text-xs text-slate-500">Generate a debrief once you have transcript turns.</div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1">{title}</div>
      <ul className="list-disc pl-5 space-y-1 text-slate-100 text-sm">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
