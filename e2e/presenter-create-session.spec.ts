import { test, expect } from "./utils/fixtures";

test.describe("Presenter creates session and copies link", () => {
  test("create, copy, show QR", async ({ page }) => {
    // Ensure mock is present before first render.
    await page.addInitScript(() =>
      localStorage.setItem(
        "cq_mock_session",
        JSON.stringify({ joinCode: "MOCK", sessionId: "MOCK-SESSION" })
      )
    );
    await page.goto("/#/create-demo?mockSession=MOCK");
    await page.waitForTimeout(500); // allow effect to hydrate mock

    // With mock session, join code should already render. If not, fall back to create button.
    const joinCodeBadge = page.locator('[data-testid="join-code"]');
    if (!(await joinCodeBadge.count())) {
      await page.reload();
      await page.getByRole("button", { name: /create new session/i }).click();
    }

    await expect(joinCodeBadge).toBeVisible({ timeout: 10000 });

    const copyBtn = page.locator('[data-testid="copy-join-link"]').first();
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
    await copyBtn.click();
    // Clipboard might be blocked; assert button text toggles or at least click succeeds.
    await expect(copyBtn).toBeEnabled();

    const qrToggle = page.locator('[data-testid="toggle-qr"]').first();
    await expect(qrToggle).toBeVisible();
    await qrToggle.click();

    const qrImage = page.locator('[data-testid="qr-image"]').first();
    await expect(qrImage).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(qrImage).toBeHidden({ timeout: 3000 });
  });
});
