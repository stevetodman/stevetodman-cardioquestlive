import { EventLogEntry } from "./types";

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
