import React, { useState } from "react";
import { AnalysisResult } from "../types/voiceGateway";

type DebriefPanelProps = {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  reportText?: string;
  sessionId?: string;
};

export function DebriefPanel({ result, isAnalyzing, onGenerate, disabled, reportText, sessionId }: DebriefPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const copyReport = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 1200);
    }
  };

  const downloadReport = () => {
    if (!reportText) return;
    try {
      const blob = new Blob([reportText], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardioquest-debrief-${sessionId ?? "session"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

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
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1">
                Summary
              </div>
              <div className="leading-snug text-slate-100">{result.summary || "—"}</div>
            </div>
            {reportText && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyReport}
                  className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[10px] text-slate-200"
                >
                  Copy report
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[10px] text-slate-200"
                >
                  Download
                </button>
                {copyStatus === "copied" && (
                  <span className="text-[10px] text-emerald-300">Copied</span>
                )}
                {copyStatus === "error" && (
                  <span className="text-[10px] text-rose-300">Copy failed</span>
                )}
              </div>
            )}
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
