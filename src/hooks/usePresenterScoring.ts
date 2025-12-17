/**
 * usePresenterScoring - Handles scoring-related computations.
 * Extracted from PresenterSession to reduce component complexity.
 */
import { useMemo, useEffect } from "react";
import { useSimulation } from "../contexts";

export interface ScoringSummary {
  score: number;
  items: string[];
}

interface UsePresenterScoringReturn {
  scoringSummary: ScoringSummary;
}

export function usePresenterScoring(): UsePresenterScoringReturn {
  const { simState, setScoringTrend } = useSimulation();

  const scoringSummary = useMemo(() => {
    const stageStart = simState?.stageEnteredAt;
    const secsSinceStart = (ts?: number) =>
      ts && stageStart ? Math.max(0, Math.round((ts - stageStart) / 1000)) : null;
    const describeTiming = (label: string, ts?: number) => {
      const delta = secsSinceStart(ts);
      return delta === null ? `${label}: not recorded` : `${label}: ${delta}s`;
    };

    const ordersComplete = (simState?.orders ?? []).filter((o) => o.status === "complete");
    const treatments = simState?.treatmentHistory ?? [];

    const ekgDone = ordersComplete.some((o) => o.type === "ekg");
    const labsDone = ordersComplete.some((o) => o.type === "labs");
    const imagingDone = ordersComplete.some((o) => o.type === "imaging");
    const vitalsOrders = ordersComplete.filter((o) => o.type === "vitals").length;

    const oxygenGiven = treatments.some((t) => t.treatmentType.toLowerCase().includes("oxygen"));
    const fluidsGiven = treatments.some(
      (t) => t.treatmentType.toLowerCase().includes("fluid") || t.treatmentType.toLowerCase().includes("bolus")
    );
    const rateControl = treatments.some((t) => t.treatmentType.toLowerCase().includes("rate"));
    const kneeChest = treatments.some(
      (t) => t.treatmentType.toLowerCase().includes("knee") || t.treatmentType.toLowerCase().includes("position")
    );

    const firstVitals = ordersComplete.find((o) => o.type === "vitals")?.completedAt;
    const firstOxygen = treatments.find((t) => t.treatmentType.toLowerCase().includes("oxygen"))?.ts;
    const firstFluids = treatments.find(
      (t) => t.treatmentType.toLowerCase().includes("fluid") || t.treatmentType.toLowerCase().includes("bolus")
    )?.ts;
    const firstRate = treatments.find((t) => t.treatmentType.toLowerCase().includes("rate"))?.ts;

    let score = 100;
    const items: string[] = [];

    if (!firstVitals) {
      score -= 10;
      items.push("Vitals refresh not recorded");
    } else {
      const delta = secsSinceStart(firstVitals);
      if (delta !== null && delta > 120) score -= 5;
      items.push(describeTiming("Vitals refreshed", firstVitals));
    }

    if (!oxygenGiven) {
      score -= 15;
      items.push("Oxygen not given");
    } else {
      const delta = secsSinceStart(firstOxygen);
      if (delta !== null && delta > 180) score -= 5;
      items.push(describeTiming("Oxygen given", firstOxygen));
    }

    if (!fluidsGiven) {
      score -= 10;
      items.push("Fluids/bolus not given");
    } else {
      items.push(describeTiming("Fluids given", firstFluids));
    }

    if (!rateControl) {
      items.push("Rate control not given");
    } else {
      items.push(describeTiming("Rate control given", firstRate));
    }

    if (kneeChest) items.push("Positioning/knee-chest applied");

    if (ekgDone) {
      items.push("EKG completed");
    } else {
      score -= 5;
      items.push("EKG pending");
    }
    if (labsDone) items.push("Labs completed");
    if (imagingDone) items.push("Imaging completed");
    if (vitalsOrders > 1) items.push(`Vitals refreshed x${vitalsOrders}`);

    score = Math.max(0, Math.min(100, score));
    return { score, items };
  }, [simState?.orders, simState?.treatmentHistory, simState?.stageEnteredAt]);

  // Update scoring trend when score changes
  useEffect(() => {
    setScoringTrend((prev) => ({
      current: scoringSummary.score,
      delta: scoringSummary.score - (prev.current ?? scoringSummary.score),
    }));
  }, [scoringSummary.score, setScoringTrend]);

  return { scoringSummary };
}
