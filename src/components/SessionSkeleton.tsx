import React from "react";

export function SessionSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-shimmer bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-[length:800px_100%] rounded-2xl p-4 border border-slate-800 shadow-xl">
      <div className="h-12 rounded-lg bg-slate-800/80" />
      <div className="h-20 rounded-xl bg-slate-900/80 border border-slate-800" />
      <div className="space-y-3">
        <div className="h-5 w-3/4 rounded bg-slate-800/80" />
        <div className="h-12 rounded-xl bg-slate-900/80 border border-slate-800" />
        <div className="h-12 rounded-xl bg-slate-900/80 border border-slate-800" />
        <div className="h-12 rounded-xl bg-slate-900/80 border border-slate-800" />
        <div className="h-12 rounded-xl bg-slate-900/80 border border-slate-800" />
      </div>
    </div>
  );
}
