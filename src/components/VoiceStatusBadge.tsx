import React from "react";

export type VoiceStateStatus = "ready" | "active" | "waiting" | "unavailable";

export interface VoiceStatusBadgeProps {
  status: VoiceStateStatus;
  message: string;
  detail?: string;
}

export function VoiceStatusBadge({ status, message, detail }: VoiceStatusBadgeProps) {
  const styles = {
    ready: {
      container: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
      dot: "bg-emerald-400 animate-pulse",
    },
    active: {
      container: "bg-sky-500/10 border-sky-500/30 text-sky-200",
      dot: "bg-sky-400 animate-ping",
    },
    waiting: {
      container: "bg-amber-500/10 border-amber-500/30 text-amber-200",
      dot: "bg-amber-400",
    },
    unavailable: {
      container: "bg-slate-800/50 border-slate-700/30 text-slate-400",
      dot: "bg-slate-500",
    },
  } as const;

  const style = styles[status];

  return (
    <div
      className={`border rounded-lg px-4 py-3 ${style.container}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          {detail && <p className="text-xs opacity-75 mt-0.5">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
