import React from "react";

export function DevGatewayBadge() {
  if (!(import.meta as any).env?.DEV) return null;
  const url = (import.meta as any).env?.VITE_VOICE_GATEWAY_URL;
  if (!url) return null;
  return (
    <div className="fixed bottom-3 right-3 z-[9999] px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-slate-100 shadow-lg shadow-black/30">
      <div className="uppercase tracking-[0.12em] text-slate-400">Voice gateway</div>
      <div className="font-mono text-[11px] text-emerald-200 break-all">{url}</div>
    </div>
  );
}
