/**
 * Orders panel for participant view.
 * Shows pending and completed orders with ETA, results, and viewer buttons.
 */

import React from "react";

export interface OrderResult {
  summary?: string;
  abnormal?: string;
  nextAction?: string;
  rationale?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  type: string;
  status: "pending" | "complete";
  result?: OrderResult;
  completedAt?: number;
  orderedBy?: { id: string; name: string; role: string };
}

export interface ParticipantOrdersPanelProps {
  orders: Order[];
  onViewEkg: (order: Order) => void;
  onViewCxr: (order: Order) => void;
  maxVisible?: number;
}

const ORDER_HEADERS: Record<string, string> = {
  vitals: "Vitals",
  ekg: "EKG",
  labs: "Labs",
  imaging: "Imaging",
};

const ORDER_ETAS: Record<string, string> = {
  vitals: "≈10s",
  ekg: "≈20s",
  labs: "≈15s",
  imaging: "≈15s",
};

const HIGHLIGHT_PATTERN = /elevated|abnormal|shock|effusion|edema|ectasia|rvh|low|high|thickened/i;

export function ParticipantOrdersPanel({
  orders,
  onViewEkg,
  onViewCxr,
  maxVisible = 6,
}: ParticipantOrdersPanelProps) {
  if (!orders.length) return null;

  const visibleOrders = orders.slice(-maxVisible);

  return (
    <div className="mt-2 bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold flex items-center justify-between">
        <span>Orders</span>
        <span className="text-[10px] text-slate-400">Student view</span>
      </div>
      <div className="space-y-1">
        {visibleOrders.map((order) => {
          const isDone = order.status === "complete";
          const header = ORDER_HEADERS[order.type] ?? order.type;
          const eta = !isDone ? ORDER_ETAS[order.type] ?? "≈15s" : null;
          const detail = order.result?.summary;
          const highlight = detail && HIGHLIGHT_PATTERN.test(detail);
          const { abnormal, nextAction, rationale } = order.result ?? {};

          return (
            <div
              key={order.id}
              className={`rounded-lg border px-3 py-2 text-[12px] ${
                isDone
                  ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-100"
                  : "border-slate-700 bg-slate-900/80 text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{header}</div>
                <div className="text-[10px] uppercase tracking-[0.14em]">
                  {isDone ? "Complete" : "Pending"}
                </div>
              </div>

              {!isDone && eta && (
                <div className="text-[11px] text-slate-400">Result in {eta}</div>
              )}

              {isDone && order.completedAt && (
                <div className="text-[10px] text-slate-400">
                  {new Date(order.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>
              )}

              {isDone && detail && (
                <div
                  className={`text-[12px] mt-1 whitespace-pre-wrap ${
                    highlight ? "text-amber-200" : "text-slate-300"
                  }`}
                >
                  {detail}
                  {abnormal && (
                    <div className="text-[11px] text-amber-200 mt-1">
                      Key abnormal: {abnormal}
                    </div>
                  )}
                  {nextAction && (
                    <div className="text-[11px] text-slate-300 mt-1">
                      Next: {nextAction}
                    </div>
                  )}
                  {rationale && (
                    <div className="text-[11px] text-slate-400 mt-1">{rationale}</div>
                  )}
                </div>
              )}

              {/* View EKG button */}
              {isDone && order.type === "ekg" && (
                <button
                  type="button"
                  onClick={() => onViewEkg(order)}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/50 text-sky-100 text-xs font-medium hover:bg-sky-600/30 hover:border-sky-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M22 12h-4l-3 9L9 3l-3 9H2"
                    />
                  </svg>
                  View EKG
                </button>
              )}

              {/* View X-Ray button */}
              {isDone && order.type === "imaging" && (
                <button
                  type="button"
                  onClick={() => onViewCxr(order)}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/50 text-sky-100 text-xs font-medium hover:bg-sky-600/30 hover:border-sky-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  View X-Ray
                </button>
              )}

              {!isDone && (
                <div className="text-[12px] text-slate-400">Result on the way…</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
