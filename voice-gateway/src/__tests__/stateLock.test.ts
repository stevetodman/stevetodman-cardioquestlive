import {
  withStateLock,
  tryWithStateLock,
  hasActiveLock,
  clearAllLocks,
  getActiveLockCount,
} from "../stateLock";

describe("stateLock", () => {
  beforeEach(() => {
    clearAllLocks();
  });

  afterEach(() => {
    clearAllLocks();
  });

  describe("withStateLock", () => {
    it("executes function and returns result", async () => {
      const result = await withStateLock("session1", "test", async () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it("serializes concurrent operations", async () => {
      const order: number[] = [];

      const p1 = withStateLock("session1", "op1", async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push(1);
      });

      const p2 = withStateLock("session1", "op2", async () => {
        order.push(2);
      });

      await Promise.all([p1, p2]);

      // p1 should complete before p2 starts
      expect(order).toEqual([1, 2]);
    });

    it("allows parallel operations on different sessions", async () => {
      const order: string[] = [];
      const start = Date.now();

      const p1 = withStateLock("session1", "op1", async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push("s1");
      });

      const p2 = withStateLock("session2", "op2", async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push("s2");
      });

      await Promise.all([p1, p2]);
      const elapsed = Date.now() - start;

      // Both should complete in ~50ms (parallel), not ~100ms (serial)
      expect(elapsed).toBeLessThan(100);
      expect(order).toHaveLength(2);
    });

    it("releases lock on success", async () => {
      await withStateLock("session1", "test", async () => {});
      expect(hasActiveLock("session1")).toBe(false);
    });

    it("releases lock on error", async () => {
      try {
        await withStateLock("session1", "test", async () => {
          throw new Error("test error");
        });
      } catch (e) {
        // Expected
      }
      expect(hasActiveLock("session1")).toBe(false);
    });

    it("propagates errors", async () => {
      await expect(
        withStateLock("session1", "test", async () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");
    });

    it("handles multiple sequential operations", async () => {
      const results: number[] = [];

      for (let i = 0; i < 5; i++) {
        await withStateLock("session1", `op${i}`, async () => {
          results.push(i);
        });
      }

      expect(results).toEqual([0, 1, 2, 3, 4]);
    });

    it("handles rapid concurrent operations", async () => {
      const results: number[] = [];

      const operations = Array.from({ length: 10 }, (_, i) =>
        withStateLock("session1", `op${i}`, async () => {
          results.push(i);
        })
      );

      await Promise.all(operations);

      // All operations should complete (order may vary based on Promise scheduling)
      expect(results).toHaveLength(10);
      expect(new Set(results).size).toBe(10);
    });
  });

  describe("tryWithStateLock", () => {
    it("executes function when lock is available", async () => {
      const result = await tryWithStateLock("session1", "test", async () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it("returns undefined when lock is held", async () => {
      // Start a long-running operation
      const p1 = withStateLock("session1", "long", async () => {
        await new Promise((r) => setTimeout(r, 100));
        return "done";
      });

      // Give it time to acquire the lock
      await new Promise((r) => setTimeout(r, 10));

      // Try to get the lock (should fail)
      const result = await tryWithStateLock("session1", "try", async () => {
        return "got it";
      });

      expect(result).toBeUndefined();

      // Clean up
      await p1;
    });
  });

  describe("hasActiveLock", () => {
    it("returns false when no lock is held", () => {
      expect(hasActiveLock("session1")).toBe(false);
    });

    it("returns true during operation", async () => {
      let lockWasActive = false;

      await withStateLock("session1", "test", async () => {
        lockWasActive = hasActiveLock("session1");
      });

      expect(lockWasActive).toBe(true);
    });
  });

  describe("getActiveLockCount", () => {
    it("returns 0 when no locks are held", () => {
      expect(getActiveLockCount()).toBe(0);
    });

    it("counts active locks", async () => {
      const p1 = withStateLock("session1", "test1", async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      const p2 = withStateLock("session2", "test2", async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Give them time to acquire locks
      await new Promise((r) => setTimeout(r, 10));

      // Both should be active
      expect(getActiveLockCount()).toBe(2);

      // Clean up
      await Promise.all([p1, p2]);
    });
  });

  describe("clearAllLocks", () => {
    it("clears all locks", async () => {
      // Start some operations (but don't await)
      withStateLock("session1", "test1", async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      withStateLock("session2", "test2", async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      // Give them time to acquire locks
      await new Promise((r) => setTimeout(r, 10));

      clearAllLocks();
      expect(getActiveLockCount()).toBe(0);
    });
  });

  describe("race condition simulation", () => {
    it("prevents state corruption from concurrent updates", async () => {
      let sharedState = { count: 0 };

      // Simulate concurrent state updates
      const operations = Array.from({ length: 100 }, () =>
        withStateLock("session1", "increment", async () => {
          const current = sharedState.count;
          // Simulate async work that could cause race conditions
          await new Promise((r) => setTimeout(r, 0));
          sharedState.count = current + 1;
        })
      );

      await Promise.all(operations);

      // All increments should be accounted for
      expect(sharedState.count).toBe(100);
    });

    it("would fail without locking (demonstration)", async () => {
      let sharedState = { count: 0 };

      // Same operations WITHOUT locking - to show the problem
      const operations = Array.from({ length: 100 }, async () => {
        const current = sharedState.count;
        await new Promise((r) => setTimeout(r, 0));
        sharedState.count = current + 1;
      });

      await Promise.all(operations);

      // Without locking, we lose updates due to race conditions
      // The count will typically be much less than 100
      expect(sharedState.count).toBeLessThan(100);
    });
  });
});
