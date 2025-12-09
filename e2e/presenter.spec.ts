import { test, expect } from "./utils/fixtures";

test.describe("Presenter utilities", () => {
  test("QR overlay toggles and copy link works", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "cq_mock_session",
        JSON.stringify({ joinCode: "MOCK", sessionId: "MOCK-SESSION" })
      )
    );
    await page.goto("/#/create-demo?mockSession=MOCK");
    await page.waitForTimeout(500);

    // Wait for join code generation area to appear (via mock or creation).
    const joinCodeBadge = page.locator('[data-testid="join-code"]');
    if (!(await joinCodeBadge.count())) {
      await page.reload();
      await page.getByRole("button", { name: /create new session/i }).click();
    }
    await expect(joinCodeBadge).toBeVisible({ timeout: 10000 });

    // Copy link button may be icon-only; fall back to data-testid if present.
    const copyBtn = page
      .getByRole("button", { name: /copy/i })
      .or(page.locator('[data-testid="copy-join-link"]'))
      .first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Clipboard may be blocked; ensure the button click does not throw and remains enabled.
    await expect(copyBtn).toBeEnabled();

    const showQR = page
      .getByRole("button", { name: /qr/i })
      .or(page.locator('[data-testid="toggle-qr"]'))
      .first();
    await showQR.click();

    const qr = page.locator('[data-testid="qr-image"]').first();
    await expect(qr).toBeVisible({ timeout: 3000 });

    // Escape should close overlay.
    await page.keyboard.press("Escape");
    await expect(qr).toBeHidden({ timeout: 3000 });
  });
});
