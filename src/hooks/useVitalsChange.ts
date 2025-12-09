import { useState, useEffect, useRef } from "react";

type Vitals = { hr?: number; bp?: string; rr?: number; spo2?: number; temp?: number };

// Thresholds for significant changes - tuned for pediatric simulation
const CHANGE_THRESHOLDS = {
  hr: 10,     // bpm - lower threshold for pediatric sensitivity
  spo2: 3,    // percent (any direction)
  rr: 4,      // breaths per minute
  temp: 0.5,  // degrees Celsius
};

/**
 * Detects significant changes in vital signs and returns which vitals
 * should be highlighted. Highlights clear after a short duration.
 *
 * Compares against the previous *target* values (not display values)
 * to avoid false positives during tweening animations.
 */
export function useVitalsChange(vitals: Vitals, duration = 2000): Set<keyof Vitals> {
  const [highlightedVitals, setHighlightedVitals] = useState<Set<keyof Vitals>>(new Set());
  const previousVitalsRef = useRef<Vitals | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previous = previousVitalsRef.current;

    // Skip first render - no comparison possible
    if (previous === null) {
      previousVitalsRef.current = { ...vitals };
      return;
    }

    const newHighlights = new Set<keyof Vitals>();

    // Compare numeric values (bidirectional - both increases and decreases matter)
    if (
      typeof previous.hr === "number" &&
      typeof vitals.hr === "number" &&
      Math.abs(vitals.hr - previous.hr) >= CHANGE_THRESHOLDS.hr
    ) {
      newHighlights.add("hr");
    }

    if (
      typeof previous.spo2 === "number" &&
      typeof vitals.spo2 === "number" &&
      Math.abs(vitals.spo2 - previous.spo2) >= CHANGE_THRESHOLDS.spo2
    ) {
      newHighlights.add("spo2");
    }

    if (
      typeof previous.rr === "number" &&
      typeof vitals.rr === "number" &&
      Math.abs(vitals.rr - previous.rr) >= CHANGE_THRESHOLDS.rr
    ) {
      newHighlights.add("rr");
    }

    if (
      typeof previous.temp === "number" &&
      typeof vitals.temp === "number" &&
      Math.abs(vitals.temp - previous.temp) >= CHANGE_THRESHOLDS.temp
    ) {
      newHighlights.add("temp");
    }

    // Blood pressure is a string - any change is significant
    if (vitals.bp && previous.bp && vitals.bp !== previous.bp) {
      newHighlights.add("bp");
    }

    // Update ref for next comparison (always, not just when highlights found)
    previousVitalsRef.current = { ...vitals };

    // If any significant changes, trigger highlights
    if (newHighlights.size > 0) {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setHighlightedVitals(newHighlights);

      // Schedule highlight removal
      timeoutRef.current = setTimeout(() => {
        setHighlightedVitals(new Set());
        timeoutRef.current = null;
      }, duration);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [vitals.hr, vitals.spo2, vitals.rr, vitals.temp, vitals.bp, duration]);

  return highlightedVitals;
}
