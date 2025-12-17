/**
 * Runtime Manager
 * Manages per-session runtime instances including scenario engine, cost controller, and realtime client.
 */

import { Runtime } from "../typesRuntime";
import { log, logError } from "../logger";
import { loadSimState } from "../persistence";

// ============================================================================
// Types
// ============================================================================

export interface RuntimeManagerState {
  runtimes: Map<string, Runtime>;
  hydratedSessions: Set<string>;
  scenarioTimers: Map<string, NodeJS.Timeout>;
}

export interface RuntimeManagerDeps {
  broadcastSimState: (sessionId: string, state: any) => void;
}

export interface RuntimeManager {
  /** Get existing runtime or undefined */
  getRuntime: (sessionId: string) => Runtime | undefined;
  /** Set runtime for session */
  setRuntime: (sessionId: string, runtime: Runtime) => void;
  /** Check if session has been hydrated */
  isHydrated: (sessionId: string) => boolean;
  /** Mark session as hydrated */
  markHydrated: (sessionId: string) => void;
  /** Get scenario timer */
  getTimer: (sessionId: string) => NodeJS.Timeout | undefined;
  /** Set scenario timer */
  setTimer: (sessionId: string, timer: NodeJS.Timeout) => void;
  /** Clear scenario timer */
  clearTimer: (sessionId: string) => void;
  /** Clean up all session state */
  cleanupSession: (sessionId: string) => void;
  /** Hydrate session state from persistence */
  hydrateSimState: (sessionId: string, runtime: Runtime) => Promise<void>;
  /** Get state for inspection */
  getState: () => RuntimeManagerState;
}

// ============================================================================
// Factory
// ============================================================================

export function createRuntimeManager(deps: RuntimeManagerDeps): RuntimeManager {
  const { broadcastSimState } = deps;

  // Internal state
  const runtimes: Map<string, Runtime> = new Map();
  const hydratedSessions: Set<string> = new Set();
  const scenarioTimers: Map<string, NodeJS.Timeout> = new Map();

  function getRuntime(sessionId: string): Runtime | undefined {
    return runtimes.get(sessionId);
  }

  function setRuntime(sessionId: string, runtime: Runtime): void {
    runtimes.set(sessionId, runtime);
  }

  function isHydrated(sessionId: string): boolean {
    return hydratedSessions.has(sessionId);
  }

  function markHydrated(sessionId: string): void {
    hydratedSessions.add(sessionId);
  }

  function getTimer(sessionId: string): NodeJS.Timeout | undefined {
    return scenarioTimers.get(sessionId);
  }

  function setTimer(sessionId: string, timer: NodeJS.Timeout): void {
    scenarioTimers.set(sessionId, timer);
  }

  function clearTimer(sessionId: string): void {
    const timer = scenarioTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      scenarioTimers.delete(sessionId);
    }
  }

  function cleanupSession(sessionId: string): void {
    const runtime = runtimes.get(sessionId);
    if (runtime?.realtime) {
      try {
        runtime.realtime.close();
      } catch {
        /* ignore */
      }
    }
    runtimes.delete(sessionId);
    clearTimer(sessionId);
    hydratedSessions.delete(sessionId);
    log("Runtime cleaned up", { sessionId });
  }

  async function hydrateSimState(sessionId: string, runtime: Runtime): Promise<void> {
    try {
      const persisted = await loadSimState(sessionId);
      if (!persisted) return;

      runtime.scenarioEngine.hydrate(persisted as any);
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        ekgHistory: runtime.scenarioEngine.getState().ekgHistory,
        telemetryHistory: runtime.scenarioEngine.getState().telemetryHistory,
        telemetryWaveform: (persisted as any).telemetryWaveform,
      });
    } catch (err) {
      logError("hydrateSimState failed", err);
    }
  }

  function getState(): RuntimeManagerState {
    return { runtimes, hydratedSessions, scenarioTimers };
  }

  return {
    getRuntime,
    setRuntime,
    isHydrated,
    markHydrated,
    getTimer,
    setTimer,
    clearTimer,
    cleanupSession,
    hydrateSimState,
    getState,
  };
}
