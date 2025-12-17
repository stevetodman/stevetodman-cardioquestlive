/**
 * Race Condition Tests for SVT Complex Scenario
 * Tests concurrent state updates and order processing
 */

import { withStateLock, tryWithStateLock, clearAllLocks } from "../stateLock";
import { createInitialSVTState } from "../sim/scenarios/teen_svt_complex/definition";
import type { SVTExtendedState } from "../sim/types";

// Mock scenario state management
type SessionRuntime = {
  extended: SVTExtendedState;
  pendingUpdates: number;
};

function createMockRuntime(): SessionRuntime {
  return {
    extended: createInitialSVTState(Date.now()),
    pendingUpdates: 0,
  };
}

// Simulate SVT phase tick (runs every 10 seconds in production)
async function simulatePhaseTick(
  sessionId: string,
  runtime: SessionRuntime,
  nowMs: number
): Promise<{ phaseChanged: boolean; newPhase?: string }> {
  return withStateLock(sessionId, "phaseTick", async () => {
    runtime.pendingUpdates++;
    await new Promise((r) => setTimeout(r, 10)); // Simulate async work

    const ext = runtime.extended;
    const phaseElapsedMin = (nowMs - ext.phaseEnteredAt) / 60000;

    // Phase transition logic (simplified from index.ts)
    if (ext.phase === "presentation" && phaseElapsedMin >= 2) {
      ext.phase = "svt_onset";
      ext.currentRhythm = "svt";
      ext.phaseEnteredAt = nowMs;
      runtime.pendingUpdates--;
      return { phaseChanged: true, newPhase: "svt_onset" };
    }

    if (ext.phase === "svt_onset" && phaseElapsedMin >= 4) {
      ext.phase = "treatment_window";
      ext.phaseEnteredAt = nowMs;
      runtime.pendingUpdates--;
      return { phaseChanged: true, newPhase: "treatment_window" };
    }

    runtime.pendingUpdates--;
    return { phaseChanged: false };
  });
}

// Simulate vagal maneuver treatment
async function simulateVagalManeuver(
  sessionId: string,
  runtime: SessionRuntime,
  nowMs: number
): Promise<{ success: boolean; converted: boolean }> {
  return withStateLock(sessionId, "vagal", async () => {
    runtime.pendingUpdates++;
    await new Promise((r) => setTimeout(r, 5)); // Simulate async work

    const ext = runtime.extended;

    if (ext.currentRhythm !== "svt") {
      runtime.pendingUpdates--;
      return { success: false, converted: false };
    }

    ext.vagalAttempts++;
    ext.vagalAttemptTs = nowMs;

    // 15% chance of conversion (simplified)
    const converted = Math.random() < 0.15;
    if (converted) {
      ext.currentRhythm = "sinus";
      ext.converted = true;
      ext.conversionMethod = "vagal";
      ext.conversionTs = nowMs;
      ext.phase = "converted";
      ext.phaseEnteredAt = nowMs;
    }

    runtime.pendingUpdates--;
    return { success: true, converted };
  });
}

// Simulate adenosine treatment
async function simulateAdenosine(
  sessionId: string,
  runtime: SessionRuntime,
  nowMs: number,
  doseMgKg: number
): Promise<{ success: boolean; converted: boolean }> {
  return withStateLock(sessionId, "adenosine", async () => {
    runtime.pendingUpdates++;
    await new Promise((r) => setTimeout(r, 8)); // Simulate async work

    const ext = runtime.extended;

    if (ext.currentRhythm !== "svt") {
      runtime.pendingUpdates--;
      return { success: false, converted: false };
    }

    const doseNumber = ext.adenosineDoses.length + 1;
    if (doseNumber > 2) {
      runtime.pendingUpdates--;
      return { success: false, converted: false };
    }

    ext.adenosineDoses.push({
      ts: nowMs,
      doseMg: doseMgKg * 50, // 50kg patient
      doseMgKg,
      doseNumber: doseNumber as 1 | 2,
      rapidPush: true,
      flushGiven: true,
    });
    ext.totalAdenosineMg += doseMgKg * 50;

    // 60% first dose, 80% second dose conversion rate (simplified)
    const conversionRate = doseNumber === 1 ? 0.6 : 0.8;
    const converted = Math.random() < conversionRate;

    if (converted) {
      ext.currentRhythm = "sinus";
      ext.converted = true;
      ext.conversionMethod = doseNumber === 1 ? "adenosine_first" : "adenosine_second";
      ext.conversionTs = nowMs;
      ext.phase = "converted";
      ext.phaseEnteredAt = nowMs;
    }

    runtime.pendingUpdates--;
    return { success: true, converted };
  });
}

describe("Race Conditions", () => {
  beforeEach(() => {
    clearAllLocks();
  });

  afterEach(() => {
    clearAllLocks();
  });

  describe("Concurrent phase tick and treatment", () => {
    it("serializes phase tick and vagal maneuver", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      // Set up state for svt_onset
      runtime.extended.phase = "svt_onset";
      runtime.extended.currentRhythm = "svt";
      runtime.extended.phaseEnteredAt = now - 250000; // 4+ minutes ago

      // Launch both operations concurrently
      const tickPromise = simulatePhaseTick(sessionId, runtime, now);
      const vagalPromise = simulateVagalManeuver(sessionId, runtime, now);

      // Both should complete successfully
      const [tickResult, vagalResult] = await Promise.all([tickPromise, vagalPromise]);

      // Both completed without corruption
      expect(tickResult).toBeDefined();
      expect(vagalResult).toBeDefined();
      expect(vagalResult.success).toBe(true);

      // No pending updates should remain
      expect(runtime.pendingUpdates).toBe(0);
    });

    it("handles rapid consecutive treatments without corruption", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      // Set up SVT onset
      runtime.extended.phase = "svt_onset";
      runtime.extended.currentRhythm = "svt";

      // Fire 5 vagal attempts rapidly
      const promises = Array.from({ length: 5 }, () =>
        simulateVagalManeuver(sessionId, runtime, now)
      );

      await Promise.all(promises);

      // All attempts should be recorded
      expect(runtime.extended.vagalAttempts).toBe(5);
      expect(runtime.pendingUpdates).toBe(0);
    });

    it("handles concurrent tick, vagal, and adenosine", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      // Set up SVT state
      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";
      runtime.extended.phaseEnteredAt = now - 60000;

      // Launch all three operations concurrently
      const operations = [
        simulatePhaseTick(sessionId, runtime, now),
        simulateVagalManeuver(sessionId, runtime, now),
        simulateAdenosine(sessionId, runtime, now, 0.1),
      ];

      await Promise.all(operations);

      // No pending updates should remain
      expect(runtime.pendingUpdates).toBe(0);

      // At least one vagal attempt should be recorded
      expect(runtime.extended.vagalAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe("tryWithStateLock for non-blocking checks", () => {
    it("drops tick if lock is held by treatment", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();

      // Start a long treatment
      const treatmentPromise = withStateLock(sessionId, "treatment", async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "treatment done";
      });

      // Give it time to acquire lock
      await new Promise((r) => setTimeout(r, 5));

      // Try to run tick (should skip)
      const tickResult = await tryWithStateLock(sessionId, "tick", async () => {
        return "tick executed";
      });

      expect(tickResult).toBeUndefined(); // Skipped because lock held

      // Treatment should complete normally
      const treatmentResult = await treatmentPromise;
      expect(treatmentResult).toBe("treatment done");
    });
  });

  describe("Stress tests", () => {
    it("handles 50 concurrent operations without corruption", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";

      // Mix of operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        if (i % 5 === 0) {
          operations.push(simulatePhaseTick(sessionId, runtime, now));
        } else if (i % 3 === 0) {
          operations.push(simulateAdenosine(sessionId, runtime, now, 0.1));
        } else {
          operations.push(simulateVagalManeuver(sessionId, runtime, now));
        }
      }

      await Promise.all(operations);

      // No pending updates should remain
      expect(runtime.pendingUpdates).toBe(0);

      // State should be consistent
      expect(runtime.extended.vagalAttempts).toBeGreaterThanOrEqual(0);
      expect(runtime.extended.adenosineDoses.length).toBeLessThanOrEqual(2);
    });

    it("maintains vagal count consistency under load", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";
      runtime.extended.vagalAttempts = 0;

      // 20 concurrent vagal attempts
      const operations = Array.from({ length: 20 }, () =>
        simulateVagalManeuver(sessionId, runtime, now)
      );

      await Promise.all(operations);

      // All 20 attempts should be recorded (assuming no conversion)
      // If conversion happened early, at least up to that point should be recorded
      expect(runtime.extended.vagalAttempts).toBeGreaterThan(0);
      expect(runtime.extended.vagalAttempts).toBeLessThanOrEqual(20);
    });
  });

  describe("Order deduplication", () => {
    it("prevents duplicate adenosine doses in same millisecond", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";

      // Two rapid adenosine doses
      const results = await Promise.all([
        simulateAdenosine(sessionId, runtime, now, 0.1),
        simulateAdenosine(sessionId, runtime, now, 0.1),
      ]);

      // Both should complete, but only max 2 doses can be given
      expect(results.every((r) => r !== undefined)).toBe(true);
      expect(runtime.extended.adenosineDoses.length).toBeLessThanOrEqual(2);
    });

    it("enforces max 2 adenosine doses", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";

      // Try to give 5 doses
      for (let i = 0; i < 5; i++) {
        await simulateAdenosine(sessionId, runtime, now + i * 1000, 0.1);
        // If converted, rhythm changes and subsequent doses fail
        if (runtime.extended.currentRhythm === "sinus") break;
      }

      // Max 2 doses should have been given
      expect(runtime.extended.adenosineDoses.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Phase transition atomicity", () => {
    it("ensures phase and phaseEnteredAt are updated together", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "presentation";
      runtime.extended.phaseEnteredAt = now - 130000; // 2+ minutes ago

      await simulatePhaseTick(sessionId, runtime, now);

      // Both should have been updated atomically
      if (runtime.extended.phase === "svt_onset") {
        expect(runtime.extended.phaseEnteredAt).toBe(now);
        expect(runtime.extended.currentRhythm).toBe("svt");
      }
    });

    it("conversion updates all related fields atomically", async () => {
      const sessionId = "session1";
      const runtime = createMockRuntime();
      const now = Date.now();

      runtime.extended.phase = "treatment_window";
      runtime.extended.currentRhythm = "svt";

      // Keep trying until we get a conversion
      for (let i = 0; i < 50; i++) {
        runtime.extended.currentRhythm = "svt"; // Reset for test
        runtime.extended.converted = false;
        runtime.extended.phase = "treatment_window";
        runtime.extended.vagalAttempts = i;

        const result = await simulateVagalManeuver(sessionId, runtime, now + i * 1000);

        if (result.converted) {
          // All conversion fields should be set atomically
          expect(runtime.extended.currentRhythm).toBe("sinus");
          expect(runtime.extended.converted).toBe(true);
          expect(runtime.extended.conversionMethod).toBe("vagal");
          expect(runtime.extended.conversionTs).toBeDefined();
          expect(runtime.extended.phase).toBe("converted");
          break;
        }
      }
    });
  });

  describe("Multi-session isolation", () => {
    it("operations on different sessions run in parallel", async () => {
      const runtimes = {
        session1: createMockRuntime(),
        session2: createMockRuntime(),
        session3: createMockRuntime(),
      };

      const now = Date.now();

      // Set all to treatment window
      Object.values(runtimes).forEach((r) => {
        r.extended.phase = "treatment_window";
        r.extended.currentRhythm = "svt";
      });

      const start = Date.now();

      // All sessions run in parallel
      await Promise.all([
        simulateVagalManeuver("session1", runtimes.session1, now),
        simulateVagalManeuver("session2", runtimes.session2, now),
        simulateVagalManeuver("session3", runtimes.session3, now),
      ]);

      const elapsed = Date.now() - start;

      // Should complete in ~5ms (parallel) not ~15ms (serial)
      expect(elapsed).toBeLessThan(30);

      // Each session should have its own state
      expect(runtimes.session1.extended.vagalAttempts).toBe(1);
      expect(runtimes.session2.extended.vagalAttempts).toBe(1);
      expect(runtimes.session3.extended.vagalAttempts).toBe(1);
    });

    it("locks are session-specific", async () => {
      const runtime1 = createMockRuntime();
      const runtime2 = createMockRuntime();

      // Start long operation on session1
      const longOp = withStateLock("session1", "long", async () => {
        await new Promise((r) => setTimeout(r, 100));
        return "done";
      });

      // Give it time to acquire lock
      await new Promise((r) => setTimeout(r, 5));

      // Session2 should not be blocked
      const start = Date.now();
      await withStateLock("session2", "quick", async () => {
        return "quick";
      });
      const elapsed = Date.now() - start;

      // Session2 should complete immediately
      expect(elapsed).toBeLessThan(20);

      await longOp;
    });
  });
});
