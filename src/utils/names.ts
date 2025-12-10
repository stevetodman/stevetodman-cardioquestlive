/**
 * Random name generator for anonymous users.
 * Names are medical/cardiology themed for fun.
 */

const ADJECTIVES = [
  "Swift",
  "Keen",
  "Calm",
  "Bold",
  "Quick",
  "Sharp",
  "Steady",
  "Bright",
  "Clever",
  "Focused",
  "Diligent",
  "Precise",
  "Astute",
  "Nimble",
  "Alert",
];

const NOUNS = [
  "Atrium",
  "Ventricle",
  "Aorta",
  "Valve",
  "Pulse",
  "Rhythm",
  "Echo",
  "Murmur",
  "Systole",
  "Diastole",
  "Apex",
  "Node",
  "Bundle",
  "Septum",
  "Pericardium",
];

/**
 * Generate a random display name like "Swift Atrium" or "Keen Pulse"
 */
export function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Get a stored random name or generate a new one.
 * Persists to localStorage so the same user keeps their name across sessions.
 */
export function getOrCreateRandomName(): string {
  const key = "cq_random_name";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const name = generateRandomName();
  localStorage.setItem(key, name);
  return name;
}
