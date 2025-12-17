import { sanitizePersistedState } from "../persistence";
import { log, logError } from "../logger";

// Mock the logger
jest.mock("../logger", () => ({
  log: jest.fn(),
  logError: jest.fn(),
}));

// Mock Firebase to prevent actual database calls
jest.mock("../firebaseAdmin", () => ({
  getFirestore: jest.fn(() => null),
}));

describe("hydration consistency validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("order timestamp validation", () => {
    it("logs warning for negative completedAt", () => {
      const state = {
        stageId: "stage1",
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const, completedAt: -1000 },
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("negative completedAt")])
      );
    });

    it("logs warning for completedAt in far future", () => {
      const state = {
        stageId: "stage1",
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const, completedAt: Date.now() + 3600_000 },
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("completedAt in far future")])
      );
    });

    it("logs warning for complete status without completedAt", () => {
      const state = {
        stageId: "stage1",
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const },
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("status 'complete' but no completedAt")])
      );
    });

    it("does not log warnings for valid orders", () => {
      const state = {
        stageId: "stage1",
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const, completedAt: Date.now() - 5000 },
          { id: "order2", type: "vitals" as const, status: "pending" as const },
        ],
      };

      sanitizePersistedState(state, Date.now());

      // No consistency warnings should be logged
      expect(log).not.toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.anything()
      );
    });
  });

  describe("timeline event monotonicity", () => {
    it("logs warning for out-of-order timeline events", () => {
      const state = {
        stageId: "stage1",
        scenarioId: "teen_svt_complex_v1",
        extended: {
          phase: "presentation",
          phaseEnteredAt: 1000,
          scenarioStartedAt: 0,
          totalPausedMs: 0,
          timelineEvents: [
            { ts: 1000, type: "phase_change", description: "Started" },
            { ts: 2000, type: "treatment", description: "Vagal" },
            { ts: 1500, type: "intervention", description: "IV placed" }, // Out of order!
          ],
        },
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("timestamp 1500 < previous 2000")])
      );
    });

    it("does not log warnings for correctly ordered timeline events", () => {
      const state = {
        stageId: "stage1",
        scenarioId: "teen_svt_complex_v1",
        extended: {
          phase: "presentation",
          phaseEnteredAt: 1000,
          scenarioStartedAt: 0,
          totalPausedMs: 0,
          timelineEvents: [
            { ts: 1000, type: "phase_change", description: "Started" },
            { ts: 2000, type: "treatment", description: "Vagal" },
            { ts: 3000, type: "intervention", description: "IV placed" },
          ],
        },
      };

      sanitizePersistedState(state, Date.now());

      // No consistency warnings should be logged for timeline
      const calls = (log as jest.Mock).mock.calls;
      const hasTimelineWarning = calls.some(
        (call) => call[0]?.includes("consistency warnings") && call[1]?.some((w: string) => w.includes("Timeline"))
      );
      expect(hasTimelineWarning).toBe(false);
    });
  });

  describe("scenario clock consistency", () => {
    it("logs warning for scenarioStartedAt in far future", () => {
      const state = {
        stageId: "stage1",
        extended: {
          scenarioStartedAt: Date.now() + 3600_000,
          totalPausedMs: 0,
        },
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("scenarioStartedAt in far future")])
      );
    });

    it("logs warning for negative totalPausedMs", () => {
      const state = {
        stageId: "stage1",
        extended: {
          scenarioStartedAt: Date.now() - 60000,
          totalPausedMs: -5000,
        },
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("totalPausedMs is negative")])
      );
    });

    it("logs warning for phaseEnteredAt before scenarioStartedAt", () => {
      const state = {
        stageId: "stage1",
        extended: {
          scenarioStartedAt: 10000,
          phaseEnteredAt: 5000, // Before start!
          totalPausedMs: 0,
        },
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("phaseEnteredAt (5000) < scenarioStartedAt (10000)")])
      );
    });
  });

  describe("history timestamp validation", () => {
    it("logs warning for out-of-order telemetryHistory", () => {
      const state = {
        stageId: "stage1",
        telemetryHistory: [
          { ts: 1000, rhythm: "sinus" },
          { ts: 2000, rhythm: "svt" },
          { ts: 1500, rhythm: "sinus" }, // Out of order!
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("telemetryHistory[2]: timestamp 1500 < previous 2000")])
      );
    });

    it("logs warning for out-of-order ekgHistory", () => {
      const state = {
        stageId: "stage1",
        ekgHistory: [
          { ts: 1000, summary: "NSR" },
          { ts: 500, summary: "SVT" }, // Out of order!
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("ekgHistory[1]: timestamp 500 < previous 1000")])
      );
    });

    it("logs warning for out-of-order treatmentHistory", () => {
      const state = {
        stageId: "stage1",
        treatmentHistory: [
          { ts: 3000, treatmentType: "adenosine" },
          { ts: 1000, treatmentType: "vagal" }, // Out of order!
        ],
      };

      sanitizePersistedState(state, Date.now());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.arrayContaining([expect.stringContaining("treatmentHistory[1]: timestamp 1000 < previous 3000")])
      );
    });
  });

  describe("valid state", () => {
    it("does not log warnings for fully valid state", () => {
      const now = Date.now();
      const state = {
        stageId: "stage1",
        scenarioId: "teen_svt_complex_v1",
        vitals: { hr: 180, bp: "90/60", spo2: 98 },
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const, completedAt: now - 60000 },
          { id: "order2", type: "vitals" as const, status: "pending" as const },
        ],
        telemetryHistory: [
          { ts: now - 120000 },
          { ts: now - 60000 },
          { ts: now - 30000 },
        ],
        ekgHistory: [
          { ts: now - 90000, summary: "SVT" },
        ],
        treatmentHistory: [
          { ts: now - 45000, treatmentType: "vagal" },
        ],
        extended: {
          phase: "treatment_window",
          scenarioStartedAt: now - 180000,
          phaseEnteredAt: now - 90000,
          totalPausedMs: 10000,
          timelineEvents: [
            { ts: now - 180000, type: "phase_change", description: "Started" },
            { ts: now - 90000, type: "phase_change", description: "SVT onset" },
          ],
        },
      };

      sanitizePersistedState(state, now);

      // No consistency warnings should be logged
      expect(log).not.toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.anything()
      );
    });
  });

  describe("graceful degradation", () => {
    it("returns data even with consistency warnings", () => {
      const state = {
        stageId: "stage1",
        scenarioId: "test",
        vitals: { hr: 100 },
        orders: [
          { id: "order1", type: "ekg" as const, status: "complete" as const, completedAt: -1000 }, // Invalid but data preserved
        ],
      };

      const result = sanitizePersistedState(state, Date.now());

      // Warning was logged
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("consistency warnings"),
        expect.anything()
      );

      // But data is still returned
      expect(result.stageId).toBe("stage1");
      expect(result.orders).toHaveLength(1);
      expect(result.orders![0].completedAt).toBe(-1000);
    });
  });
});
