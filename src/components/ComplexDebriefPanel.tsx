import React, { useState } from "react";
import { ComplexDebriefResult } from "../types/voiceGateway";

type ComplexDebriefPanelProps = {
  result: ComplexDebriefResult | null;
  onClose: () => void;
};

export function ComplexDebriefPanel({ result, onClose }: ComplexDebriefPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  if (!result) return null;

  const gradeColor = {
    A: "text-emerald-400",
    B: "text-green-400",
    C: "text-yellow-400",
    D: "text-orange-400",
    F: "text-red-400",
  }[result.grade];

  const copyReport = async () => {
    const reportText = buildReportText(result);
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Complex Scenario Debrief</h2>
            <p className="text-xs text-slate-400">
              {result.scenarioId === "teen_svt_complex_v1" ? "Teen SVT (PALS Algorithm)" : "Pediatric Myocarditis"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyReport}
              className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              {copyStatus === "copied" ? "Copied!" : "Copy Report"}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none px-2"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Grade & Score */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${gradeColor}`}>{result.grade}</div>
              <div>
                <div className={`text-lg font-semibold ${result.passed ? "text-emerald-400" : "text-red-400"}`}>
                  {result.passed ? "PASSED" : "DID NOT PASS"}
                </div>
                <div className="text-sm text-slate-400">Checklist: {result.checklistScore}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{result.totalPoints}</div>
              <div className="text-xs text-slate-400">Total Points</div>
            </div>
          </div>

          {/* AI Summary */}
          <Section title="Summary">
            <p className="text-slate-200 leading-relaxed">{result.summary}</p>
          </Section>

          {/* Checklist */}
          <Section title="Checklist">
            <div className="space-y-2">
              {result.checklistResults.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-2 rounded-lg ${
                    item.achieved ? "bg-emerald-900/20" : "bg-red-900/20"
                  }`}
                >
                  <span className={`text-lg ${item.achieved ? "text-emerald-400" : "text-red-400"}`}>
                    {item.achieved ? "✓" : "✗"}
                  </span>
                  <div>
                    <div className="text-sm text-slate-200">{item.description}</div>
                    <div className="text-xs text-slate-400">{item.explanation}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Bonuses */}
          {result.bonuses.length > 0 && (
            <Section title="Bonuses Earned">
              <div className="space-y-1">
                {result.bonuses.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{b.description}</span>
                    <span className="text-emerald-400 font-semibold">+{b.points}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Penalties */}
          {result.penalties.length > 0 && (
            <Section title="Penalties">
              <div className="space-y-1">
                {result.penalties.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{p.description}</span>
                    <span className="text-red-400 font-semibold">{p.points}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Timeline */}
          {result.timeline.length > 0 && (
            <Section title="Timeline">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.timeline.map((event, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 text-sm p-1.5 rounded ${
                      event.isGood ? "bg-emerald-900/10" : event.isBad ? "bg-red-900/10" : ""
                    }`}
                  >
                    <span className="text-slate-500 font-mono w-12 flex-shrink-0">
                      {event.timeFormatted}
                    </span>
                    <span
                      className={`${
                        event.isGood ? "text-emerald-300" : event.isBad ? "text-red-300" : "text-slate-300"
                      }`}
                    >
                      {event.description}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Strengths */}
          <Section title="Strengths">
            <ul className="list-disc pl-5 space-y-1 text-slate-200 text-sm">
              {result.strengths.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* Opportunities */}
          <Section title="Areas for Improvement">
            <ul className="list-disc pl-5 space-y-1 text-slate-200 text-sm">
              {result.opportunities.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* Teaching Points */}
          <Section title="Teaching Points">
            <ul className="list-disc pl-5 space-y-1 text-slate-200 text-sm">
              {result.teachingPoints.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </Section>

          {/* Scenario-Specific Feedback */}
          {result.scenarioSpecificFeedback.length > 0 && (
            <Section title="Scenario Feedback">
              <ul className="list-disc pl-5 space-y-1 text-slate-200 text-sm">
                {result.scenarioSpecificFeedback.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function buildReportText(result: ComplexDebriefResult): string {
  const parts: string[] = [];

  parts.push("# Complex Scenario Debrief Report");
  parts.push(`Scenario: ${result.scenarioId}`);
  parts.push(`Generated: ${new Date().toISOString()}`);
  parts.push("");
  parts.push(`## Result: ${result.passed ? "PASSED" : "DID NOT PASS"}`);
  parts.push(`Grade: ${result.grade}`);
  parts.push(`Checklist Score: ${result.checklistScore}`);
  parts.push(`Total Points: ${result.totalPoints}`);
  parts.push("");
  parts.push("## Summary");
  parts.push(result.summary);
  parts.push("");
  parts.push("## Checklist");
  result.checklistResults.forEach((item) => {
    parts.push(`- [${item.achieved ? "x" : " "}] ${item.description}`);
    parts.push(`  - ${item.explanation}`);
  });
  if (result.bonuses.length > 0) {
    parts.push("");
    parts.push("## Bonuses");
    result.bonuses.forEach((b) => parts.push(`- ${b.description}: +${b.points} pts`));
  }
  if (result.penalties.length > 0) {
    parts.push("");
    parts.push("## Penalties");
    result.penalties.forEach((p) => parts.push(`- ${p.description}: ${p.points} pts`));
  }
  if (result.timeline.length > 0) {
    parts.push("");
    parts.push("## Timeline");
    result.timeline.forEach((e) => parts.push(`- ${e.timeFormatted}: ${e.description}`));
  }
  parts.push("");
  parts.push("## Strengths");
  result.strengths.forEach((s) => parts.push(`- ${s}`));
  parts.push("");
  parts.push("## Areas for Improvement");
  result.opportunities.forEach((o) => parts.push(`- ${o}`));
  parts.push("");
  parts.push("## Teaching Points");
  result.teachingPoints.forEach((t) => parts.push(`- ${t}`));
  if (result.scenarioSpecificFeedback.length > 0) {
    parts.push("");
    parts.push("## Scenario Feedback");
    result.scenarioSpecificFeedback.forEach((f) => parts.push(`- ${f}`));
  }

  return parts.join("\n");
}
