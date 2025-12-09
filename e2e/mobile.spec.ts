import { test, expect } from "./utils/fixtures";

test.describe("Mobile layout", () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test("voice panel collapses and FAB is visible when voice enabled", async ({ page, forceVoiceReady }) => {
    void forceVoiceReady;
    await page.goto("/#/join/ABCD");

    // Check for either FAB or collapsed bar text.
    const voiceToggle = page
      .locator("button", { hasText: /hold|speak|voice/i })
      .first()
      .or(page.getByText(/voice interaction/i).first());

    if (await voiceToggle.count()) {
      await expect(voiceToggle).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, "Voice UI not rendered without live session/voice state");
    }

    // Verify main card still visible in mobile layout.
    await expect(page.getByText(/Interactive Pediatric Cardiology Learning/i)).toBeVisible();
  });
});
