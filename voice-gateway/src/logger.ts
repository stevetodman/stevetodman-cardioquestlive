export function log(...args: any[]) {
  console.log(new Date().toISOString(), ...args);
}

export function logError(...args: any[]) {
  console.error(new Date().toISOString(), ...args);
}

export function logEvent(event: string, payload?: Record<string, unknown>) {
  const suffix = payload ? JSON.stringify(payload) : "";
  console.log(new Date().toISOString(), `[event:${event}]`, suffix);
}
