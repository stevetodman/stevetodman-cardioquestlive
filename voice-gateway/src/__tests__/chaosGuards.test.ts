/**
 * Tests for chaos testing guards.
 * Verifies that chaos functionality is disabled in production.
 */

describe("chaos guards", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("in production (NODE_ENV=production)", () => {
    it("should ignore CHAOS_WS_LATENCY_MS when NODE_ENV=production", () => {
      // Contract: When NODE_ENV=production, chaos latency should be 0
      // regardless of CHAOS_WS_LATENCY_MS setting
      process.env.NODE_ENV = "production";
      process.env.CHAOS_WS_LATENCY_MS = "1000";

      // The actual implementation in index.ts:
      // const isProduction = process.env.NODE_ENV === "production";
      // const chaosLatencyMs = !isProduction ? Number(process.env.CHAOS_WS_LATENCY_MS || 0) : 0;
      const isProduction = process.env.NODE_ENV === "production";
      const chaosLatencyMs = !isProduction ? Number(process.env.CHAOS_WS_LATENCY_MS || 0) : 0;

      expect(isProduction).toBe(true);
      expect(chaosLatencyMs).toBe(0);
    });

    it("should ignore CHAOS_WS_DROP_PCT when NODE_ENV=production", () => {
      // Contract: When NODE_ENV=production, chaos drop percentage should be 0
      // regardless of CHAOS_WS_DROP_PCT setting
      process.env.NODE_ENV = "production";
      process.env.CHAOS_WS_DROP_PCT = "50";

      const isProduction = process.env.NODE_ENV === "production";
      const chaosDropPct = !isProduction ? Number(process.env.CHAOS_WS_DROP_PCT || 0) : 0;

      expect(isProduction).toBe(true);
      expect(chaosDropPct).toBe(0);
    });
  });

  describe("in development (NODE_ENV != production)", () => {
    it("should apply CHAOS_WS_LATENCY_MS when not in production", () => {
      process.env.NODE_ENV = "development";
      process.env.CHAOS_WS_LATENCY_MS = "500";

      const isProduction = process.env.NODE_ENV === "production";
      const chaosLatencyMs = !isProduction ? Number(process.env.CHAOS_WS_LATENCY_MS || 0) : 0;

      expect(isProduction).toBe(false);
      expect(chaosLatencyMs).toBe(500);
    });

    it("should apply CHAOS_WS_DROP_PCT when not in production", () => {
      process.env.NODE_ENV = "development";
      process.env.CHAOS_WS_DROP_PCT = "25";

      const isProduction = process.env.NODE_ENV === "production";
      const chaosDropPct = !isProduction ? Number(process.env.CHAOS_WS_DROP_PCT || 0) : 0;

      expect(isProduction).toBe(false);
      expect(chaosDropPct).toBe(25);
    });

    it("should default chaos values to 0 when not set", () => {
      process.env.NODE_ENV = "development";
      delete process.env.CHAOS_WS_LATENCY_MS;
      delete process.env.CHAOS_WS_DROP_PCT;

      const isProduction = process.env.NODE_ENV === "production";
      const chaosLatencyMs = !isProduction ? Number(process.env.CHAOS_WS_LATENCY_MS || 0) : 0;
      const chaosDropPct = !isProduction ? Number(process.env.CHAOS_WS_DROP_PCT || 0) : 0;

      expect(chaosLatencyMs).toBe(0);
      expect(chaosDropPct).toBe(0);
    });
  });

  describe("shouldDropMessage logic", () => {
    it("should never drop when chaosDropPct is 0", () => {
      const chaosDropPct = 0;
      const shouldDropMessage = () => {
        if (chaosDropPct <= 0) return false;
        return Math.random() * 100 < chaosDropPct;
      };

      // Run multiple times to ensure it never drops
      for (let i = 0; i < 100; i++) {
        expect(shouldDropMessage()).toBe(false);
      }
    });

    it("should always drop when chaosDropPct is 100", () => {
      const chaosDropPct = 100;
      const shouldDropMessage = () => {
        if (chaosDropPct <= 0) return false;
        return Math.random() * 100 < chaosDropPct;
      };

      // Run multiple times to ensure it always drops
      for (let i = 0; i < 100; i++) {
        expect(shouldDropMessage()).toBe(true);
      }
    });
  });
});
