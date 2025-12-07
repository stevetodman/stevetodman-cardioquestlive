/**
 * Firestore emulator-aware tests. These will be skipped if FIRESTORE_EMULATOR_HOST is not set.
 */
import { persistSimState, logSimEvent } from "../persistence";
import { getFirestore } from "../firebaseAdmin";
import admin from "firebase-admin";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe("persistence helpers (emulator)", () => {
  if (!emulatorHost) {
    it.skip("skipped because FIRESTORE_EMULATOR_HOST is not set", () => {});
    return;
  }

  const simId = "test-sim";

  beforeAll(() => {
    // ensure firestore is initialized against emulator
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    getFirestore();
  });

  afterAll(async () => {
    const db = getFirestore();
    if (db) {
      await db.recursiveDelete(db.collection("sessions").doc(simId));
    }
    admin.app()?.delete?.().catch(() => {});
  });

  it("persists sim state", async () => {
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
    await logSimEvent(simId, { type: "tool.intent.received", payload: { foo: "bar" } });
    const db = getFirestore()!;
    const snap = await db.collection("sessions").doc(simId).collection("events").get();
    expect(snap.empty).toBeFalsy();
    const evt = snap.docs[0].data();
    expect(evt.type).toBe("tool.intent.received");
    expect(evt.payload.foo).toBe("bar");
  });
});
