import { useState, useCallback, useEffect } from "react";
import { PresenterMode, DEFAULT_PRESENTER_MODE } from "../types/presenterMode";

const STORAGE_KEY = "cq_presenter_mode";

/**
 * Hook for managing presenter view mode with localStorage persistence.
 * Returns current mode and setter function.
 */
export function usePresenterMode(): [PresenterMode, (mode: PresenterMode) => void] {
  const [mode, setModeState] = useState<PresenterMode>(() => {
    if (typeof window === "undefined") return DEFAULT_PRESENTER_MODE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ["presentation", "voice", "gamification"].includes(stored)) {
        return stored as PresenterMode;
      }
    } catch {
      // localStorage may be unavailable
    }
    return DEFAULT_PRESENTER_MODE;
  });

  const setMode = useCallback((newMode: PresenterMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  return [mode, setMode];
}
