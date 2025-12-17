/**
 * State Lock - Prevents race conditions in concurrent state mutations
 *
 * This module provides a simple async mutex pattern for serializing
 * access to session-specific state. Used primarily for:
 * - SVT phase transitions (heartbeat tick vs treatment handlers)
 * - Order processing (duplicate detection)
 * - Extended state updates
 */

import { log, logError } from "./logger";

// Map of session ID to lock state
interface LockState {
  queue: Promise<void>;
  count: number;
}
const sessionLocks = new Map<string, LockState>();

// Lock timeout to prevent deadlocks (5 seconds)
const LOCK_TIMEOUT_MS = 5000;

/**
 * Execute a function with exclusive access to session state.
 *
 * @param sessionId - The session to lock
 * @param operation - Description for logging
 * @param fn - The async function to execute
 * @returns The result of the function
 * @throws If the lock times out or the function throws
 *
 * @example
 * ```typescript
 * await withStateLock(sessionId, "updatePhase", async () => {
 *   const state = getState();
 *   state.phase = "svt_onset";
 *   await persistState(state);
 * });
 * ```
 */
export async function withStateLock<T>(
  sessionId: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockStart = Date.now();
  let lockAcquired = false;

  // Get or create lock state for this session
  const lockState = sessionLocks.get(sessionId) ?? { queue: Promise.resolve(), count: 0 };
  const existingQueue = lockState.queue;

  // Increment count before any async work
  lockState.count++;
  sessionLocks.set(sessionId, lockState);

  // Create our lock
  let resolveOurLock: () => void;
  const ourLock = new Promise<void>((resolve) => {
    resolveOurLock = resolve;
  });

  // Chain our lock after existing ones
  lockState.queue = existingQueue.then(() => ourLock);

  try {
    // Wait for previous operations to complete (with timeout)
    await Promise.race([
      existingQueue,
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`State lock timeout for session ${sessionId} operation ${operation}`));
        }, LOCK_TIMEOUT_MS);
      }),
    ]);

    lockAcquired = true;
    const waitTime = Date.now() - lockStart;

    if (waitTime > 100) {
      log(`[stateLock] ${operation} waited ${waitTime}ms for lock on ${sessionId}`);
    }

    // Execute the function
    const result = await fn();
    return result;
  } catch (err) {
    if (!lockAcquired) {
      logError(`[stateLock] Lock timeout for ${sessionId}:`, operation, err);
    }
    throw err;
  } finally {
    // Release our lock
    resolveOurLock!();

    // Decrement count and clean up if no more locks pending
    const currentState = sessionLocks.get(sessionId);
    if (currentState) {
      currentState.count--;
      if (currentState.count <= 0) {
        sessionLocks.delete(sessionId);
      }
    }
  }
}

/**
 * Execute a function with exclusive access, but don't block if lock is held.
 * Returns undefined if lock is unavailable.
 *
 * Useful for operations that can be skipped if contention exists.
 *
 * @param sessionId - The session to lock
 * @param operation - Description for logging
 * @param fn - The async function to execute
 * @returns The result of the function, or undefined if lock unavailable
 */
export async function tryWithStateLock<T>(
  sessionId: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  // Check if there's an existing lock
  const existingLock = sessionLocks.get(sessionId);
  if (existingLock) {
    log(`[stateLock] Skipping ${operation} on ${sessionId} - lock held`);
    return undefined;
  }

  return withStateLock(sessionId, operation, fn);
}

/**
 * Check if a session currently has a lock held.
 * Useful for debugging and monitoring.
 */
export function hasActiveLock(sessionId: string): boolean {
  return sessionLocks.has(sessionId);
}

/**
 * Clear all locks. Only use in tests or shutdown.
 */
export function clearAllLocks(): void {
  sessionLocks.clear();
}

/**
 * Get the number of active locks. For monitoring.
 */
export function getActiveLockCount(): number {
  return sessionLocks.size;
}
