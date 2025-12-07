import { validateMessage } from "../validators";

describe("validateMessage", () => {
  it("accepts a valid join with authToken", () => {
    const msg = validateMessage({
      type: "join",
      sessionId: "s1",
      userId: "u1",
      role: "participant",
      authToken: "token",
    });
    expect(msg).toBeTruthy();
    expect(msg?.type).toBe("join");
  });

  it("rejects invalid shapes", () => {
    const msg = validateMessage({ type: "join", sessionId: "s1" });
    expect(msg).toBeNull();
  });

  it("passes doctor_audio with required fields", () => {
    const msg = validateMessage({
      type: "doctor_audio",
      sessionId: "s1",
      userId: "u1",
      audioBase64: "abcd",
      contentType: "audio/webm",
    });
    expect(msg).toBeTruthy();
  });

  it("accepts voice_command variants handled by the gateway", () => {
    const base = {
      type: "voice_command" as const,
      sessionId: "s1",
      userId: "u1",
      payload: { stageId: "stage_2" },
    };
    const cmds = ["freeze", "unfreeze", "skip_stage", "pause_ai", "resume_ai", "force_reply"] as const;
    cmds.forEach((commandType) => {
      const msg = validateMessage({ ...base, commandType });
      expect(msg?.type).toBe("voice_command");
      expect(msg && "commandType" in msg ? (msg as any).commandType : null).toBe(commandType);
    });
  });

  it("rejects unknown voice_command types", () => {
    const msg = validateMessage({
      type: "voice_command",
      sessionId: "s1",
      userId: "u1",
      commandType: "not_a_command",
    });
    expect(msg).toBeNull();
  });
});
