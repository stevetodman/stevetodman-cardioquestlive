/**
 * Lightweight smoke: validate a join + doctor_audio path stays within schema.
 * Does not open a real socket; uses validators to ensure messages are accepted and sim_state broadcasts pass validation.
 */
import { validateMessage, validateSimStateMessage } from "../validators";

describe("ws protocol smoke", () => {
  it("accepts a participant join and doctor_audio messages", () => {
    const join = validateMessage({
      type: "join",
      sessionId: "sim1",
      userId: "u1",
      role: "participant",
      authToken: "token",
    });
    expect(join?.type).toBe("join");

    const audio = validateMessage({
      type: "doctor_audio",
      sessionId: "sim1",
      userId: "u1",
      audioBase64: "abcd",
      contentType: "audio/webm",
    });
    expect(audio?.type).toBe("doctor_audio");
  });

  it("accepts a minimal sim_state broadcast payload", () => {
    const simState = validateSimStateMessage({
      stageId: "stage_1_baseline",
      vitals: { hr: 90 },
      fallback: false,
    });
    expect(simState).toBeTruthy();
    expect(simState?.stageId).toBe("stage_1_baseline");
  });
});
