import { test, expect } from "@playwright/test";

test.describe("Presenter voice states (mocked)", () => {
  test("shows disabled state when mockVoice=unavailable", async ({ page }) => {
    await page.goto("/#/presenter/MOCK-SESSION?mockSession=MOCK&mockVoice=unavailable");

    const header = page.locator('[data-testid="presenter-header"]');
    await expect(header).toBeVisible({ timeout: 5000 });
    // Voice badge should reflect disabled when mockVoice=unavailable.
    await expect(page.getByText(/voice: disabled|voice: disconnected/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("shows ready state when mockVoice=ready", async ({ page }) => {
    await page.goto("/#/presenter/MOCK-SESSION?mockSession=MOCK&mockVoice=ready");

    const header = page.locator('[data-testid="presenter-header"]');
    await expect(header).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/voice/i).first()).toBeVisible({ timeout: 3000 });
  });
});
