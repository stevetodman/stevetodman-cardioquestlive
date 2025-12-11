import { useState, useEffect } from "react";
import { voiceEventLogger, VoiceEvent } from "../../services/voiceEventLogger";

interface VoiceDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  correlationId?: string;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventColor(type: VoiceEvent["type"]): string {
  switch (type) {
    case "voice_error":
      return "text-red-400";
    case "voice_fallback":
      return "text-amber-400";
    case "voice_recovered":
      return "text-green-400";
    case "voice_connected":
      return "text-emerald-400";
    case "voice_disconnected":
      return "text-slate-400";
    default:
      return "text-slate-300";
  }
}

export function VoiceDebugPanel({ isOpen, onClose, correlationId }: VoiceDebugPanelProps) {
  const [events, setEvents] = useState<VoiceEvent[]>([]);

  useEffect(() => {
    // Get initial events
    setEvents(voiceEventLogger.getEvents());
    // Subscribe to updates
    const unsub = voiceEventLogger.subscribe(setEvents);
    return unsub;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Voice Debug Panel</h2>
            {correlationId && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Correlation ID: {correlationId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => voiceEventLogger.clear()}
              className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No voice events recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {events
                .slice()
                .reverse()
                .map((event, i) => (
                  <div
                    key={`${event.timestamp}-${i}`}
                    className="flex items-start gap-3 text-sm font-mono"
                  >
                    <span className="text-slate-500 w-20 flex-shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span className={`${getEventColor(event.type)} w-32 flex-shrink-0`}>
                      {event.type}
                    </span>
                    <span className="text-slate-300 flex-1 break-all">
                      {event.error && <span className="text-red-400">[{event.error}] </span>}
                      {event.detail || "—"}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          Showing {events.length} event{events.length !== 1 ? "s" : ""} (max 50)
        </div>
      </div>
    </div>
  );
}
