import { useState } from "react";

interface CxrViewerProps {
  imageUrl?: string;
  summary?: string;
  timestamp?: number;
  orderedBy?: { name: string };
  patientName?: string;
  viewType?: "PA" | "AP" | "Lateral";
  onClose: () => void;
}

/**
 * PACS-like chest X-ray viewer with dark radiology background.
 * Mobile-optimized with zoom toggle and large tap targets.
 */
export function CxrViewer({
  imageUrl,
  summary,
  timestamp,
  orderedBy,
  patientName = "Patient",
  viewType = "PA",
  onClose,
}: CxrViewerProps) {
  const [zoom, setZoom] = useState<"fit" | "2x" | "4x">("fit");
  const [showTools, setShowTools] = useState(false);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
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
    setZoom((prev) => (prev === "fit" ? "2x" : prev === "2x" ? "4x" : "fit"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
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
            <h1 className="text-white font-semibold">Chest X-Ray</h1>
            <p className="text-gray-400 text-sm">
              {patientName} • {viewType} View
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tools toggle (dummy) */}
          <button
            onClick={() => setShowTools(!showTools)}
            className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center ${
              showTools
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </button>

          {/* Zoom toggle */}
          <button
            onClick={cycleZoom}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 active:bg-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {zoom === "fit" ? "Fit" : zoom}
          </button>
        </div>
      </header>

      {/* Tools panel (dummy) */}
      {showTools && (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3">
          <button className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 flex items-center gap-1 opacity-50 cursor-not-allowed" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
            </svg>
            W/L
          </button>
          <button className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 flex items-center gap-1 opacity-50 cursor-not-allowed" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Zoom
          </button>
          <button className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 flex items-center gap-1 opacity-50 cursor-not-allowed" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Pan
          </button>
          <button className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 flex items-center gap-1 opacity-50 cursor-not-allowed" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        </div>
      )}

      {/* X-ray Image */}
      <div className="flex-1 overflow-auto bg-black relative">
        {/* L/R markers */}
        <div className="absolute top-4 left-4 z-10">
          <span className="text-white text-lg font-bold bg-black/50 px-2 py-1 rounded">L</span>
        </div>
        <div className="absolute top-4 right-4 z-10">
          <span className="text-white text-lg font-bold bg-black/50 px-2 py-1 rounded">R</span>
        </div>

        <div className={`p-4 ${zoom === "fit" ? "flex items-center justify-center min-h-full" : ""}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Chest X-Ray"
              className={zoom === "fit" ? "max-w-full max-h-full object-contain" : "w-auto h-auto max-w-none"}
              style={
                zoom === "2x"
                  ? { transform: "scale(2)", transformOrigin: "top left" }
                  : zoom === "4x"
                  ? { transform: "scale(4)", transformOrigin: "top left" }
                  : undefined
              }
            />
          ) : (
            <div className="text-center py-20">
              <div className="text-gray-500 text-lg">No X-ray image available</div>
              {summary && <div className="text-gray-400 mt-2 max-w-md mx-auto">{summary}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Footer with metadata */}
      <footer className="bg-gray-950 border-t border-gray-800 px-4 py-3">
        {/* Summary/findings */}
        {summary && (
          <div className="mb-3 p-2 bg-gray-900 rounded text-sm text-gray-300">
            <span className="text-gray-500 font-medium">Findings: </span>
            {summary}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded font-mono">
              {viewType}
            </span>
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
