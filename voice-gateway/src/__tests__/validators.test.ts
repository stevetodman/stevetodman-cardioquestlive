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
});
