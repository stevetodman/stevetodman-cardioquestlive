import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, db } from "../utils/firestore"; // Updated import

interface Props {
  sessionId: string;
  questionId: string;
  options: string[];
  correctIndex: number;
  showResults: boolean;
  mode?: "presenter" | "participant";
}

export type ResponsesMode = 'presenter' | 'participant';

export function ResponsesChart({
  sessionId,
  questionId,
  options,
  correctIndex,
  showResults,
  mode = "participant",
}: Props) {
  const [counts, setCounts] = useState<number[]>(() =>
    Array(options.length).fill(0)
  );

  const barColors = [
    "bg-cyan-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-indigo-500",
  ];

  useEffect(() => {
    const q = query(
      collection(db, "sessions", sessionId, "responses"),
      where("questionId", "==", questionId)
    );

    const unsub = onSnapshot(q, (snapshot: any) => {
      const arr = Array(options.length).fill(0);
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        const idx = (data.choiceIndex ?? 0) as number;
        if (idx >= 0 && idx < arr.length) arr[idx] += 1;
      });
      setCounts(arr);
    });

    return () => unsub();
  }, [sessionId, questionId, options.length]);

  const totalRaw = counts.reduce((a, b) => a + b, 0);
  const total = totalRaw === 0 ? 1 : totalRaw;

  return (
    <div className="space-y-3 text-xs w-full">
      <h3 className="text-slate-300 font-semibold text-sm border-b border-slate-800 pb-2 mb-4 flex items-center justify-between">
        Live Responses
        <span className="text-[10px] text-slate-500">Total: {totalRaw}</span>
      </h3>
      {totalRaw === 0 && (
        <div className="text-slate-500 text-xs bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
          Waiting for responses…
        </div>
      )}
      {options.map((opt, i) => {
        const pct = Math.round((counts[i] / total) * 100);
        const isCorrect = showResults && i === correctIndex;
        const color = barColors[i % barColors.length];
        const label = String.fromCharCode(65 + i);

        if (mode === "presenter") {
          return (
            <div key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-[11px]">
                {label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out ${color} ${isCorrect ? "ring-1 ring-emerald-300" : ""}`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className={`text-[11px] ${isCorrect ? "text-emerald-400" : "text-slate-400"}`}>{pct}%</span>
            </div>
          );
        }

        return (
          <div key={i} className="space-y-1">
            <div className={`flex items-center gap-2 text-sm font-semibold ${isCorrect ? "text-emerald-400" : "text-slate-200"}`}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-[11px]">
                {label}
              </span>
              <span className="truncate">{opt}</span>
              <span className="ml-auto text-slate-400 text-xs">{pct}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 ease-out ${color} ${isCorrect ? "ring-1 ring-emerald-300" : ""}`}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
