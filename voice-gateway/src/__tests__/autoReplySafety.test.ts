import { shouldAutoReply } from "../autoReplyGuard";
import { isUnsafeUtterance } from "../speechHelpers";

describe("auto-reply safety hold", () => {
  test("blocks unsafe utterances from auto-reply", () => {
    const maps = {
      lastAutoReplyAt: new Map<string, number>(),
      lastAutoReplyByUser: new Map<string, number>(),
      lastDoctorUtterance: new Map<string, { text: string; ts: number }>(),
    };
    const unsafe = isUnsafeUtterance("This is shit");
    const allow = shouldAutoReply({
      sessionId: "sim-1",
      userId: "u1",
      text: "This is shit",
      explicitCharacter: undefined,
      floorHolder: "u1",
      commandCooldownMs: 3000,
      maps,
    });
    expect(unsafe).toBe(true);
    expect(allow).toBe(false);
  });
});
