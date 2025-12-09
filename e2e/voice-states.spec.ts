import { test, expect } from "./utils/fixtures";

test.describe("Voice UI states (UI-only)", () => {
  test("placeholder shown when voice disabled", async ({ page }) => {
    await page.goto("/#/join/VOICE?mockSession=VOICE&mockVoice=unavailable");

    const placeholder = page.getByText(/voice will be available when the presenter enables it/i).first();
    await expect(placeholder).toBeVisible({ timeout: 3000 });
  });
});
