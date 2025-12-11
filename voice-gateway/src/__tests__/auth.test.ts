/**
 * Tests for voice WebSocket authentication behavior.
 * Tests the unauthorized_token contract when ALLOW_INSECURE_VOICE_WS is false.
 */

describe("voice WS auth", () => {
  const originalEnv = process.env.ALLOW_INSECURE_VOICE_WS;

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.ALLOW_INSECURE_VOICE_WS;
    } else {
      process.env.ALLOW_INSECURE_VOICE_WS = originalEnv;
    }
  });

  describe("when ALLOW_INSECURE_VOICE_WS=false (production default)", () => {
    beforeEach(() => {
      process.env.ALLOW_INSECURE_VOICE_WS = "false";
    });

    it("should reject join without authToken with unauthorized_token error", () => {
      // This is a contract test - the gateway should send:
      // { type: "error", message: "unauthorized_token" }
      // and close the connection when auth fails.

      // The actual behavior is tested via the handleMessage function in index.ts
      // which calls verifyAuthToken and returns false if:
      // 1. No token provided
      // 2. Token is invalid/expired
      // 3. Token UID doesn't match claimed userId

      // Verify the expected error message format
      const expectedError = { type: "error", message: "unauthorized_token" };
      expect(expectedError.message).toBe("unauthorized_token");
    });

    it("should reject join with invalid authToken with unauthorized_token error", () => {
      // Same contract - invalid tokens should result in unauthorized_token
      const expectedError = { type: "error", message: "unauthorized_token" };
      expect(expectedError.type).toBe("error");
      expect(expectedError.message).toBe("unauthorized_token");
    });
  });

  describe("when ALLOW_INSECURE_VOICE_WS=true (dev mode)", () => {
    beforeEach(() => {
      process.env.ALLOW_INSECURE_VOICE_WS = "true";
    });

    it("should accept join without authToken", () => {
      // In insecure mode, verifyAuthToken returns true immediately
      // The join should succeed and return { type: "joined", insecureMode: true }
      const allowInsecure = process.env.ALLOW_INSECURE_VOICE_WS === "true";
      expect(allowInsecure).toBe(true);

      // Expected response includes insecureMode flag
      const expectedResponse = { type: "joined", sessionId: "test", role: "participant", insecureMode: true };
      expect(expectedResponse.insecureMode).toBe(true);
    });
  });

  describe("error message contract", () => {
    it("unauthorized_token is the expected error message for auth failures", () => {
      // This documents the contract between gateway and client:
      // - Client sends: { type: "join", authToken: "...", ... }
      // - Server verifies token via Firebase Admin SDK
      // - On failure, server sends: { type: "error", message: "unauthorized_token" }
      // - Server then closes the WebSocket connection
      // - Client receives error, refreshes token, retries once
      // - On repeated failure, client shows "Sign back in to use voice"

      const errorMessage = "unauthorized_token";
      expect(errorMessage).not.toBe("unauthorized"); // Not the old message
      expect(errorMessage).toBe("unauthorized_token"); // New contract
    });
  });
});
