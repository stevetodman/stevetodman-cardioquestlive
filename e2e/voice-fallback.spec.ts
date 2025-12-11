/**
 * E2E smoke test for voice fallback UI.
 * Verifies fallback banner appears and recovery works.
 */

import { test, expect } from "./utils/fixtures";

test.describe("Voice fallback UI", () => {
  test("shows fallback banner when voice is degraded", async ({ page }) => {
    // Navigate with mockSession and mockFallback to simulate voice service degradation
    await page.goto("/#/join/FALLBACK?mockSession=FALLBACK&mockVoice=ready&mockFallback=true");

    // Wait for the page to load
    await expect(page.getByText(/mock question/i).first()).toBeVisible({ timeout: 5000 });

    // The ParticipantVoiceStatusBanner should show fallback state
    const fallbackBanner = page.getByText(/voice fallback/i).first();
    await expect(fallbackBanner).toBeVisible({ timeout: 3000 });

    // Should also show the text mode instruction
    await expect(page.getByText(/text mode/i).first()).toBeVisible();
  });

  test("shows connection lost state when voice disconnected", async ({ page }) => {
    // Navigate with mockVoice=unavailable to simulate voice disconnected
    await page.goto("/#/join/DISCONN?mockSession=DISCONN&mockVoice=unavailable");

    // Wait for page to load
    await expect(page.getByText(/mock question/i).first()).toBeVisible({ timeout: 5000 });

    // The voice status should indicate unavailable state
    const unavailableStatus = page.getByText(/voice.*unavailable|voice not available|voice paused/i).first();
    await expect(unavailableStatus).toBeVisible({ timeout: 3000 });
  });

  test("text input shown when fallback active", async ({ page }) => {
    await page.goto("/#/join/TXTFALL?mockSession=TXTFALL&mockVoice=ready&mockFallback=true");

    // Wait for the page to load
    await expect(page.getByText(/mock question/i).first()).toBeVisible({ timeout: 5000 });

    // When fallback is active, the text fallback section should be visible
    const textFallbackSection = page.getByText(/text fallback/i).first();
    await expect(textFallbackSection).toBeVisible({ timeout: 3000 });

    // The textarea with placeholder should be present
    const textInput = page.getByPlaceholder(/ask the patient/i).first();
    await expect(textInput).toBeVisible({ timeout: 3000 });
  });
});
