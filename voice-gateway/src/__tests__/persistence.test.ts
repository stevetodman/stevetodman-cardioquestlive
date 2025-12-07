/** @jest-environment node */
/**
 * Firestore emulator-aware tests. These will be skipped if FIRESTORE_EMULATOR_HOST/PROJECT not set.
 */
import { persistSimState, logSimEvent } from "../persistence";
import { getFirestore } from "../firebaseAdmin";
import admin from "firebase-admin";

// Polyfill setImmediate for jsdom-like environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).setImmediate =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).setImmediate ?? ((fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args));

jest.setTimeout(20000);

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GOOGLE_CLOUD_PROJECT;

const canRun = Boolean(emulatorHost && projectId);

(canRun ? describe : describe.skip)("persistence helpers (emulator)", () => {
  let emulatorAvailable = true;

  const simId = "test-sim";

  beforeAll(() => {
    // ensure firestore is initialized against emulator
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    try {
      const db = getFirestore();
      if (!db) {
        emulatorAvailable = false;
        return;
      }
    } catch (err) {
      console.warn("Skipping persistence tests; emulator not reachable", err);
      emulatorAvailable = false;
    }
  });

  afterAll(async () => {
    if (!emulatorAvailable) return;
    const db = getFirestore();
    if (db) {
      await db.recursiveDelete(db.collection("sessions").doc(simId));
    }
    admin.app()?.delete?.().catch(() => {});
  });

  it("persists sim state", async () => {
    if (!emulatorAvailable) return;
    await persistSimState(simId, {
      simId,
      scenarioId: "syncope",
      stageId: "stage_1",
      vitals: { hr: 90 },
      fallback: false,
    } as any);
    const db = getFirestore()!;
    const snap = await db.collection("sessions").doc(simId).get();
    expect(snap.exists).toBeTruthy();
    const data = snap.data()!;
    expect(data.stageId).toBe("stage_1");
    expect(data.vitals.hr).toBe(90);
  });

  it("logs events", async () => {
    if (!emulatorAvailable) return;
    await logSimEvent(simId, { type: "tool.intent.received", payload: { foo: "bar" } });
    const db = getFirestore()!;
    const snap = await db.collection("sessions").doc(simId).collection("events").get();
    expect(snap.empty).toBeFalsy();
    const evt = snap.docs[0].data();
    expect(evt.type).toBe("tool.intent.received");
    expect(evt.payload.foo).toBe("bar");
  });
});
