import { CHARACTER_VOICES, getVoiceForCharacter, VALID_TTS_VOICES } from "../voiceConfig";

describe("voiceConfig", () => {
  describe("CHARACTER_VOICES", () => {
    it("should have all 6 character types defined", () => {
      expect(CHARACTER_VOICES.patient).toBeDefined();
      expect(CHARACTER_VOICES.parent).toBeDefined();
      expect(CHARACTER_VOICES.nurse).toBeDefined();
      expect(CHARACTER_VOICES.tech).toBeDefined();
      expect(CHARACTER_VOICES.consultant).toBeDefined();
      expect(CHARACTER_VOICES.imaging).toBeDefined();
    });

    it("should use valid TTS voices", () => {
      Object.values(CHARACTER_VOICES).forEach((voice) => {
        expect(VALID_TTS_VOICES).toContain(voice);
      });
    });

    it("should have distinct voices for distinct roles", () => {
      // patient and parent should have different voices
      expect(CHARACTER_VOICES.patient).not.toBe(CHARACTER_VOICES.parent);
      // nurse and tech should have different voices
      expect(CHARACTER_VOICES.nurse).not.toBe(CHARACTER_VOICES.tech);
    });
  });

  describe("getVoiceForCharacter", () => {
    it("should return the configured voice for a character", () => {
      expect(getVoiceForCharacter("patient")).toBe(CHARACTER_VOICES.patient);
      expect(getVoiceForCharacter("nurse")).toBe(CHARACTER_VOICES.nurse);
    });

    it("should use override when provided", () => {
      expect(getVoiceForCharacter("patient", "echo")).toBe("echo");
    });

    it("should fall back to patient voice for unknown characters", () => {
      // @ts-expect-error - testing invalid input
      expect(getVoiceForCharacter("unknown")).toBe(CHARACTER_VOICES.patient);
    });
  });

  describe("VALID_TTS_VOICES", () => {
    it("should include standard voices", () => {
      expect(VALID_TTS_VOICES).toContain("alloy");
      expect(VALID_TTS_VOICES).toContain("echo");
      expect(VALID_TTS_VOICES).toContain("fable");
      expect(VALID_TTS_VOICES).toContain("onyx");
      expect(VALID_TTS_VOICES).toContain("nova");
      expect(VALID_TTS_VOICES).toContain("shimmer");
    });

    it("should include natural voices", () => {
      expect(VALID_TTS_VOICES).toContain("coral");
      expect(VALID_TTS_VOICES).toContain("sage");
      expect(VALID_TTS_VOICES).toContain("verse");
      expect(VALID_TTS_VOICES).toContain("ballad");
    });
  });
});
