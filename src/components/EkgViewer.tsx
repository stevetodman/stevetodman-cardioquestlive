import { useState } from "react";

interface EkgViewerProps {
  imageUrl?: string;
  summary?: string;
  timestamp?: number;
  orderedBy?: { name: string };
  patientName?: string;
  onClose: () => void;
}

/**
 * Muse-like EKG viewer with dark grid background.
 * Mobile-optimized with zoom toggle and large tap targets.
 */
export function EkgViewer({
  imageUrl,
  summary,
  timestamp,
  orderedBy,
  patientName = "Patient",
  onClose,
}: EkgViewerProps) {
  const [zoom, setZoom] = useState<"fit" | "1x" | "2x">("fit");

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const cycleZoom = () => {
    setZoom((prev) => (prev === "fit" ? "1x" : prev === "1x" ? "2x" : "fit"));
  };

  const zoomScale = zoom === "fit" ? "100%" : zoom === "1x" ? "100%" : "200%";
  const zoomClass =
    zoom === "fit"
      ? "w-full h-auto object-contain"
      : zoom === "1x"
      ? "w-auto h-auto max-w-none"
      : "w-auto h-auto max-w-none scale-200 origin-center";

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-gray-400 hover:text-white active:bg-gray-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-semibold">12-Lead ECG</h1>
            <p className="text-gray-400 text-sm">{patientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom toggle */}
          <button
            onClick={cycleZoom}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 active:bg-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {zoom === "fit" ? "Fit" : zoom}
          </button>
        </div>
      </header>

      {/* EKG Grid Background + Image */}
      <div
        className="flex-1 overflow-auto"
        style={{
          backgroundImage: `
            linear-gradient(rgba(220, 38, 38, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220, 38, 38, 0.15) 1px, transparent 1px),
            linear-gradient(rgba(220, 38, 38, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220, 38, 38, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "25px 25px, 25px 25px, 5px 5px, 5px 5px",
          backgroundColor: "#0a0a0a",
        }}
      >
        <div className={`p-4 ${zoom === "fit" ? "flex items-center justify-center min-h-full" : ""}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="12-Lead ECG"
              className={zoom === "fit" ? "max-w-full max-h-full object-contain" : zoomClass}
              style={zoom === "2x" ? { transform: "scale(2)", transformOrigin: "top left" } : undefined}
            />
          ) : (
            <div className="text-center py-20">
              <div className="text-gray-500 text-lg">No ECG image available</div>
              {summary && <div className="text-gray-400 mt-2 max-w-md mx-auto">{summary}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Footer with metadata */}
      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-3">
        {/* Lead labels */}
        <div className="flex flex-wrap gap-2 mb-3">
          {["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"].map((lead) => (
            <span
              key={lead}
              className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded font-mono"
            >
              {lead}
            </span>
          ))}
        </div>

        {/* Settings badges */}
        <div className="flex items-center gap-3 mb-3">
          <span className="px-2 py-1 bg-gray-800 text-green-400 text-xs rounded font-mono">
            25 mm/s
          </span>
          <span className="px-2 py-1 bg-gray-800 text-green-400 text-xs rounded font-mono">
            10 mm/mV
          </span>
          <span className="px-2 py-1 bg-gray-800 text-blue-400 text-xs rounded font-mono">
            0.5-40 Hz
          </span>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mb-3 p-2 bg-gray-800/50 rounded text-sm text-gray-300">
            <span className="text-gray-500 font-medium">Interpretation: </span>
            {summary}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>{formattedDate}</span>
            <span>{formattedTime}</span>
            {orderedBy?.name && <span>Ordered by: {orderedBy.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {/* Dummy buttons */}
            <button
              className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 opacity-50 cursor-not-allowed"
              disabled
            >
              Print
            </button>
            <button
              className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 opacity-50 cursor-not-allowed"
              disabled
            >
              Download
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
