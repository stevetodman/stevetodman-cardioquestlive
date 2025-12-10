/**
 * Presenter view header with session info, join code, status badges.
 */

import React from "react";

export interface PresenterHeaderProps {
  joinCode: string;
  joinUrl: string | null;
  questionStateLabel: string;
  questionStateTone: string;
  responseTotal: number;
  voiceStatus: "ready" | "disabled" | "disconnected";
  onCopyResult: (message: string) => void;
  onLeave: () => void;
}

export function PresenterHeader({
  joinCode,
  joinUrl,
  questionStateLabel,
  questionStateTone,
  responseTotal,
  voiceStatus,
  onCopyResult,
  onLeave,
}: PresenterHeaderProps) {
  const handleCopyOrShare = async () => {
    if (!joinUrl) return;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ url: joinUrl, text: `Join CardioQuest Live: ${joinCode}` });
        return;
      }
    } catch {
      // ignore share errors
    }
    try {
      await navigator.clipboard.writeText(joinUrl);
      onCopyResult("Join link copied");
    } catch {
      onCopyResult("Copy failed");
    }
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 py-2 px-3 md:px-4 border-b border-slate-900"
      data-testid="presenter-header"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-sm font-semibold text-slate-100">Presenter View</div>
        <div className="text-[11px] text-slate-400 truncate">Session: {joinCode}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-full">
        <div className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1 min-w-[160px]">
          <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em]">Join</span>
          <span className="font-mono text-xs text-sky-200 truncate">{joinCode}</span>
          <button
            type="button"
            onClick={handleCopyOrShare}
            className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
          >
            Copy
          </button>
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded-full border ${questionStateTone}`}>
          {questionStateLabel}
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
          Responses: {responseTotal}
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
          Voice: {voiceStatus}
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
