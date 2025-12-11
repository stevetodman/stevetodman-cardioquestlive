import { EventLogEntry } from "./types";
import { logSimEvent } from "../persistence";

export interface EventLogger {
  append(event: EventLogEntry): void;
  getRecent?(limit?: number): EventLogEntry[];
}

export class InMemoryEventLog implements EventLogger {
  private events: EventLogEntry[] = [];

  append(event: EventLogEntry): void {
    this.events.push(event);
    // Keep memory bounded in dev; this is primarily a dev aide.
    if (this.events.length > 5000) {
      this.events.shift();
    }
  }

  getRecent(limit = 50): EventLogEntry[] {
    return this.events.slice(-limit);
  }
}

export class ConsoleEventLog implements EventLogger {
  append(event: EventLogEntry): void {
    // Intentionally terse to avoid log spam in prod.
    console.debug("[sim-event]", event.type, { simId: event.simId, payload: event.payload });
  }
}

/**
 * Firestore-backed event logger for production replay/debugging.
 * Writes events to sessions/{simId}/events subcollection.
 * Falls back gracefully if Firestore is unavailable.
 */
export class FirestoreEventLog implements EventLogger {
  append(event: EventLogEntry): void {
    // Fire and forget - don't block on persistence
    logSimEvent(event.simId, {
      type: event.type,
      payload: event.payload,
      correlationId: event.correlationId,
    }).catch(() => {
      // Silently fail - logging should not break the app
    });
  }
}

/**
 * Combined logger that writes to multiple backends.
 * Use in production for both in-memory debugging and Firestore replay.
 */
export class CompositeEventLog implements EventLogger {
  private loggers: EventLogger[];
  private memoryLog?: InMemoryEventLog;

  constructor(...loggers: EventLogger[]) {
    this.loggers = loggers;
    // Find the in-memory logger for getRecent
    this.memoryLog = loggers.find((l) => l instanceof InMemoryEventLog) as InMemoryEventLog | undefined;
  }

  append(event: EventLogEntry): void {
    for (const logger of this.loggers) {
      try {
        logger.append(event);
      } catch {
        // Ignore individual logger failures
      }
    }
  }

  getRecent(limit = 50): EventLogEntry[] {
    return this.memoryLog?.getRecent(limit) ?? [];
  }
}

/**
 * Create the appropriate event logger based on environment.
 * In production with Firestore, uses composite (memory + Firestore).
 * Otherwise, uses memory-only.
 */
export function createEventLog(): EventLogger {
  const isProd = process.env.NODE_ENV === "production";
  const hasFirestore = !!process.env.FIREBASE_SERVICE_ACCOUNT;

  if (isProd && hasFirestore) {
    return new CompositeEventLog(new InMemoryEventLog(), new FirestoreEventLog());
  }
  return new InMemoryEventLog();
}
