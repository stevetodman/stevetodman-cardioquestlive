/** @jest-environment node */
import { readFileSync } from "fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";

const rules = readFileSync("firestore.rules", "utf8");

let testEnv: RulesTestEnvironment | undefined;
let emulatorAvailable = true;

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

function isEnvReady() {
  if (!testEnv) {
    console.warn("Firestore emulator not available; skipping rules test.");
    return false;
  }
  return true;
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
    emulatorAvailable = false;
  }
});

afterAll(async () => {
  if (!isEnvReady()) return;
  await testEnv?.cleanup();
});

beforeEach(async () => {
  if (!isEnvReady()) return;
  await testEnv?.clearFirestore();
});

const describeIfEmulator = emulatorAvailable ? describe : describe.skip;

const baseSession = {
  createdBy: "creator",
  joinCode: "ABCD",
  slides: [],
  questions: [],
  currentSlideIndex: 0,
  currentQuestionId: null,
  showResults: false,
};

describeIfEmulator("firestore.rules sessions", () => {
  test("allows creator create/update but blocks others and createdBy changes", async () => {
    if (!isEnvReady()) return;
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
    if (!isEnvReady()) return;
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

describeIfEmulator("firestore.rules voice controls", () => {
  const sessionId = "session-voice";

  beforeEach(async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}`), baseSession);
    });
  });

  test("session owner can update voice state and create voice commands", async () => {
    if (!isEnvReady()) return;
    const ownerDb = getEnv().authenticatedContext(baseSession.createdBy).firestore();
    const sessionRef = doc(ownerDb, `sessions/${sessionId}`);

    await assertSucceeds(
      updateDoc(sessionRef, {
        voice: {
          enabled: true,
          floorHolderId: null,
          floorHolderName: null,
          since: null,
          mode: "idle",
        },
      })
    );

    const cmdRef = doc(ownerDb, `sessions/${sessionId}/voiceCommands/cmd1`);
    await assertSucceeds(
      setDoc(cmdRef, {
        type: "force_reply",
        createdAt: new Date(),
        createdBy: baseSession.createdBy,
        payload: { doctorUtterance: "hello" },
      })
    );
  });

  test("session participant can update voice state", async () => {
    if (!isEnvReady()) return;
    const participantId = "participant-1";
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}/participants/${participantId}`), {
        userId: participantId,
        sessionId,
        teamId: "team_ductus",
        teamName: "Team Ductus",
        points: 0,
        streak: 0,
        correctCount: 0,
        incorrectCount: 0,
        createdAt: new Date(),
      });
    });

    const participantDb = getEnv().authenticatedContext(participantId).firestore();
    const sessionRef = doc(participantDb, `sessions/${sessionId}`);

    await assertSucceeds(
      updateDoc(sessionRef, {
        voice: {
          enabled: true,
          floorHolderId: participantId,
          floorHolderName: "Resident",
          since: new Date(),
          mode: "resident-speaking",
        },
      })
    );
  });

  test("non-owner non-participant cannot update voice state or create voice commands", async () => {
    if (!isEnvReady()) return;
    const otherDb = getEnv().authenticatedContext("not-owner").firestore();
    const sessionRef = doc(otherDb, `sessions/${sessionId}`);

    await assertFails(
      updateDoc(sessionRef, {
        voice: {
          enabled: true,
          floorHolderId: null,
          floorHolderName: null,
          since: null,
          mode: "idle",
        },
      })
    );

    const cmdRef = doc(otherDb, `sessions/${sessionId}/voiceCommands/cmd1`);
    await assertFails(
      setDoc(cmdRef, {
        type: "force_reply",
        createdAt: new Date(),
        createdBy: "not-owner",
      })
    );
  });
});

describeIfEmulator("firestore.rules responses", () => {
  const sessionId = "session-resp";

  beforeEach(async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}`), baseSession);
    });
  });

  test("allows deterministic response create/update for same user", async () => {
    if (!isEnvReady()) return;
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
    if (!isEnvReady()) return;
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

describeIfEmulator("firestore.rules configs", () => {
  test("allows authenticated read of configs/deck", async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "configs/deck"), { slides: [] });
    });
    const userDb = getEnv().authenticatedContext("user").firestore();
    await assertSucceeds(getDoc(doc(userDb, "configs/deck")));
  });

  test("blocks unauthenticated read of configs/deck", async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "configs/deck"), { slides: [] });
    });
    const anonDb = getEnv().unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "configs/deck")));
  });

  test("only admin can write configs", async () => {
    if (!isEnvReady()) return;
    const userDb = getEnv().authenticatedContext("user").firestore();
    await assertFails(setDoc(doc(userDb, "configs/deck"), { slides: [] }));

    const adminDb = getEnv().authenticatedContext("admin", { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(adminDb, "configs/deck"), { slides: [] }));
  });
});

describeIfEmulator("firestore.rules participants", () => {
  const sessionId = "session-participants";

  beforeEach(async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}`), baseSession);
    });
  });

  test("allows participant create/update for own doc with required fields", async () => {
    if (!isEnvReady()) return;
    const userId = "u1";
    const user = getEnv().authenticatedContext(userId);
    const db = user.firestore();
    const participantRef = doc(db, `sessions/${sessionId}/participants/${userId}`);
    await assertSucceeds(
      setDoc(participantRef, {
        userId,
        sessionId,
        teamId: "team_ductus",
        teamName: "Team Ductus",
        points: 0,
        streak: 0,
        correctCount: 0,
        incorrectCount: 0,
        createdAt: new Date(),
      })
    );
    await assertSucceeds(updateDoc(participantRef, { points: 100, streak: 1 }));
  });

  test("allows authenticated users to read participants docs", async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}/participants/u1`), {
        userId: "u1",
        sessionId,
        teamId: "team_ductus",
        teamName: "Team Ductus",
        points: 10,
        streak: 1,
        correctCount: 1,
        incorrectCount: 0,
        createdAt: new Date(),
      });
    });

    const presenterDb = getEnv().authenticatedContext("presenter").firestore();
    await assertSucceeds(getDoc(doc(presenterDb, `sessions/${sessionId}/participants/u1`)));
  });

  test("blocks unauthenticated read of participants", async () => {
    if (!isEnvReady()) return;
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}/participants/u2`), {
        userId: "u2",
        sessionId,
        teamId: "team_cyanosis",
        teamName: "Team Cyanosis",
        points: 5,
        streak: 0,
        correctCount: 0,
        incorrectCount: 1,
        createdAt: new Date(),
      });
    });

    const anonDb = getEnv().unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, `sessions/${sessionId}/participants/u2`)));
  });

  test("blocks cross-user writes", async () => {
    if (!isEnvReady()) return;
    const participantRef = doc(
      getEnv().authenticatedContext("writer").firestore(),
      `sessions/${sessionId}/participants/u1`
    );
    await assertFails(
      setDoc(participantRef, {
        userId: "u1",
        sessionId,
        teamId: "team_ductus",
        teamName: "Team Ductus",
        points: 0,
        streak: 0,
        correctCount: 0,
        incorrectCount: 0,
        createdAt: new Date(),
      })
    );

    // cross-user update attempt
    await getEnv().withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `sessions/${sessionId}/participants/u1`), {
        userId: "u1",
        sessionId,
        teamId: "team_ductus",
        teamName: "Team Ductus",
        points: 0,
        streak: 0,
        correctCount: 0,
        incorrectCount: 0,
        createdAt: new Date(),
      });
    });

    await assertFails(
      updateDoc(participantRef, {
        points: 50,
      })
    );
  });
});
