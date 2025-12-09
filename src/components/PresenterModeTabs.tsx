import React from "react";
import { PresenterMode, PRESENTER_MODES } from "../types/presenterMode";

interface PresenterModeTabsProps {
  activeMode: PresenterMode;
  onModeChange: (mode: PresenterMode) => void;
}

/**
 * Tab bar for switching between presenter view modes.
 * Designed to be unobtrusive and fit within the existing presenter header area.
 */
export function PresenterModeTabs({ activeMode, onModeChange }: PresenterModeTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-xl px-1.5 py-1 shadow-sm shadow-black/20">
      {PRESENTER_MODES.map((mode) => {
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onModeChange(mode.id)}
            title={mode.description}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
              isActive
                ? "bg-sky-600/20 border-sky-500/60 text-sky-100 shadow-sm shadow-sky-900/30"
                : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
            aria-pressed={isActive}
            data-testid={`presenter-mode-${mode.id}`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
