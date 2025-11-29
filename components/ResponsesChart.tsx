import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, db } from "../utils/firestore"; 

interface Props {
  sessionId: string;
  questionId: string;
  options: string[];
  correctIndex: number;
  showResults: boolean;
}

export function ResponsesChart({
  sessionId,
  questionId,
  options,
  correctIndex,
  showResults,
}: Props) {
  const [counts, setCounts] = useState<number[]>(() =>
    Array(options.length).fill(0)
  );

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
      <h3 className="text-slate-300 font-semibold text-sm border-b border-slate-800 pb-2 mb-4">
        Live Responses
      </h3>
      {options.map((opt, i) => {
        const pct = Math.round((counts[i] / total) * 100);
        const isCorrect = showResults && i === correctIndex;

        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-end">
              <span className={`font-medium ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-slate-400">{pct}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  isCorrect ? "bg-emerald-500" : "bg-sky-500/80"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 truncate pl-1">
                {opt}
            </div>
          </div>
        );
      })}
      <div className="pt-2 text-[10px] text-slate-500 text-right">
        Total responses: {totalRaw}
      </div>
    </div>
  );
}