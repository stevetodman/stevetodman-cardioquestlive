import React from "react";
import { generateQrSvgData } from "../utils/simpleQr";

interface QRCodeOverlayProps {
  open: boolean;
  onClose: () => void;
  joinUrl: string;
  code: string;
}

export function QRCodeOverlay({ open, onClose, joinUrl, code }: QRCodeOverlayProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  if (!open) return null;
  const dataUrl = generateQrSvgData(joinUrl, 280);

  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Join code QR"
    >
      <div
        ref={panelRef}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/40 relative"
      >
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 text-sm"
          aria-label="Close QR overlay"
        >
          ✕
        </button>
        <div className="text-center space-y-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Scan to join
          </div>
          <div className="text-2xl font-mono text-sky-300 tracking-[0.3em]">{code}</div>
          <p className="text-xs text-slate-400 break-all">{joinUrl}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center">
          <img
            src={dataUrl}
            alt={`Join code ${code}`}
            className="w-full max-w-xs aspect-square"
          />
        </div>
        <p className="text-center text-[11px] text-slate-500 mt-3">
          Point your camera and tap the link to join.
        </p>
      </div>
    </div>
  );
}
