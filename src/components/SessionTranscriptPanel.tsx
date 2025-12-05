import React, { useMemo, useState } from "react";

export type TranscriptLogTurn = {
  id: string;
  role: "doctor" | "patient";
  timestamp: number;
  text: string;
  relatedTurnId?: string;
};

interface SessionTranscriptPanelProps {
  turns: TranscriptLogTurn[];
  sessionId: string;
}

function formatTimebase(turns: TranscriptLogTurn[], timestamp: number) {
  const base = turns.length > 0 ? turns[0].timestamp : timestamp;
  const diffSeconds = Math.max(0, Math.round((timestamp - base) / 1000));
  const minutes = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (diffSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function serialize(turns: TranscriptLogTurn[]) {
  const base = turns.length > 0 ? turns[0].timestamp : Date.now();
  return turns
    .map((turn) => {
      const rel = Math.max(0, Math.round((turn.timestamp - base) / 1000));
      const minutes = Math.floor(rel / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (rel % 60).toString().padStart(2, "0");
      const who = turn.role === "doctor" ? "Doctor" : "Patient";
      return `${who} (${minutes}:${seconds}): ${turn.text}`;
    })
    .join("\n\n");
}

export function SessionTranscriptPanel({ turns, sessionId }: SessionTranscriptPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const textBlob = useMemo(() => serialize(turns), [turns]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textBlob);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (err) {
      console.warn("Failed to copy transcript", err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([textBlob], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardioquest-session-transcript-${sessionId || "session"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Failed to download transcript", err);
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm shadow-black/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Transcript (Presenter)
          </div>
          <div className="text-xs text-slate-500">Doctor ↔ Patient turns for debrief</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600 text-slate-100"
          >
            Copy transcript
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600 text-slate-100"
          >
            Download .txt
          </button>
          {copyStatus === "copied" && (
            <span className="text-[11px] text-emerald-300">Copied!</span>
          )}
          {copyStatus === "error" && <span className="text-[11px] text-rose-300">Copy failed</span>}
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {turns.length === 0 ? (
          <div className="text-xs text-slate-500">No transcript turns yet.</div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1 flex items-center justify-between">
                <span>{turn.role === "doctor" ? "Doctor" : "Patient"}</span>
                <span className="text-[10px] text-slate-500">
                  {formatTimebase(turns, turn.timestamp)}
                </span>
              </div>
              <div className="leading-snug whitespace-pre-wrap">{turn.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
