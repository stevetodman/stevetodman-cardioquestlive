/** @jest-environment node */
import { readFileSync } from "fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const rules = readFileSync("firestore.rules", "utf8");

let testEnv: RulesTestEnvironment | undefined;

function resolveFirestoreEmulator() {
  const rawHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8088";
  try {
    const url = rawHost.includes("://") ? new URL(rawHost) : new URL(`http://${rawHost}`);
    const port = Number(url.port || 8080);
    return { host: url.hostname, port: Number.isNaN(port) ? 8080 : port };
  } catch {
    return { host: "127.0.0.1", port: 8080 };
  }
}

function getEnv(): RulesTestEnvironment {
  if (!testEnv) {
    throw new Error("Firestore test environment not initialized. Ensure beforeAll completed.");
  }
  return testEnv;
}

beforeAll(async () => {
  const firestore = resolveFirestoreEmulator();
  try {
    testEnv = await initializeTestEnvironment({
      projectId: "cardioquest-live-test",
      firestore: { ...firestore, rules },
    });
  } catch (error) {
    console.warn(
      "Failed to connect to the Firestore emulator. Start it with `firebase emulators:start --only firestore --project cardioquest-live-test` and retry."
    );
    throw error;
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv?.clearFirestore();
});

const baseSession = {
  createdBy: "creator",
  joinCode: "ABCD",
  slides: [],
  questions: [],
  currentSlideIndex: 0,
  currentQuestionId: null,
  showResults: false,
};

describe("firestore.rules sessions", () => {
  test("allows creator create/update but blocks others and createdBy changes", async () => {
    const creator = getEnv().authenticatedContext("creator");
    const creatorDb = creator.firestore();
    const sessionRef = doc(creatorDb, "sessions/session1");

    await assertSucceeds(setDoc(sessionRef, baseSession));
    await assertSucceeds(updateDoc(sessionRef, { currentSlideIndex: 1 }));

    const other = getEnv().authenticatedContext("other");
    await assertFails(updateDoc(doc(other.firestore(), "sessions/session1"), { currentSlideIndex: 2 }));
    await assertFails(updateDoc(sessionRef, { createdBy: "hijack" }));
  });

  test("rejects create when createdBy does not match auth uid", async () => {
    const user = getEnv().authenticatedContext("alice");
    const db = user.firestore();
    const sessionRef = doc(db, "sessions/session-mismatch");
    await assertFails(
      setDoc(sessionRef, {
        ...baseSession,
        createdBy: "someone-else",
      })
    );
  });
});

describe("firestore.rules responses", () => {
  const sessionId = "session-resp";

  beforeEach(async () => {
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}`), baseSession);
    });
  });

  test("allows deterministic response create/update for same user", async () => {
    const userId = "u1";
    const user = getEnv().authenticatedContext(userId);
    const db = user.firestore();
    const responseRef = doc(db, `sessions/${sessionId}/responses/${userId}_q1`);

    await assertSucceeds(
      setDoc(responseRef, {
        userId,
        questionId: "q1",
        choiceIndex: 0,
      })
    );
    await assertSucceeds(updateDoc(responseRef, { choiceIndex: 1 }));
  });

  test("blocks responses with non-deterministic ids or cross-user updates", async () => {
    const userId = "u1";
    const db = getEnv().authenticatedContext(userId).firestore();
    await assertFails(
      setDoc(doc(db, `sessions/${sessionId}/responses/random`), {
        userId,
        questionId: "q1",
        choiceIndex: 0,
      })
    );

    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}/responses/${userId}_q1`), {
        userId,
        questionId: "q1",
        choiceIndex: 0,
      });
    });

    const other = getEnv().authenticatedContext("other");
    await assertFails(updateDoc(doc(other.firestore(), `sessions/${sessionId}/responses/${userId}_q1`), { choiceIndex: 2 }));

    const owner = getEnv().authenticatedContext(userId);
    await assertFails(
      updateDoc(doc(owner.firestore(), `sessions/${sessionId}/responses/${userId}_q1`), {
        questionId: "q2",
      })
    );
  });
});

describe("firestore.rules configs", () => {
  test("only admin can write configs", async () => {
    const userDb = getEnv().authenticatedContext("user").firestore();
    await assertFails(setDoc(doc(userDb, "configs/deck"), { slides: [] }));

    const adminDb = getEnv().authenticatedContext("admin", { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(adminDb, "configs/deck"), { slides: [] }));
  });
});
