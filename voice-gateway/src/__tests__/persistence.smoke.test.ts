import { persistSimState, logSimEvent } from "../persistence";
import { getFirestore } from "../firebaseAdmin";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const db = getFirestore();

// Skip when emulator/credentials are not available.
const emulatorAvailable = Boolean(emulatorHost && db);

describe("persistence smoke (emulator)", () => {
  if (!emulatorAvailable) {
    it("skips when emulator is not running", () => {
      expect(true).toBe(true);
    });
    return;
  }

  const simId = `persistence-smoke-${Date.now()}`;

  afterAll(async () => {
    try {
      await db!.recursiveDelete(db!.collection("sessions").doc(simId));
    } catch {
      // best-effort cleanup
    }
  });

  it("persists sim state to sessions/{simId}", async () => {
    await persistSimState(simId, {
      simId,
      scenarioId: "syncope",
      stageId: "stage_1_baseline",
      vitals: { hr: 90, bp: "110/70" },
      findings: ["hpi_start"],
      fallback: false,
    });

    const snap = await db!.collection("sessions").doc(simId).get();
    expect(snap.exists).toBe(true);
    const data = snap.data()!;
    expect(data.stageId).toBe("stage_1_baseline");
    expect(data.findings).toContain("hpi_start");
    expect(data.vitals?.hr).toBe(90);
  });

  it("appends events under sessions/{simId}/events", async () => {
    await logSimEvent(simId, { type: "test.event", payload: { foo: "bar" } });

    const eventsSnap = await db!
      .collection("sessions")
      .doc(simId)
      .collection("events")
      .orderBy("ts", "desc")
      .limit(1)
      .get();

    expect(eventsSnap.empty).toBe(false);
    const doc = eventsSnap.docs[0]!.data();
    expect(doc.type).toBe("test.event");
    expect(doc.payload?.foo).toBe("bar");
  });
});
