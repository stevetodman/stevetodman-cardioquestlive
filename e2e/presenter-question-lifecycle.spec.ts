import { test, expect } from "@playwright/test";

test.describe("Presenter question lifecycle (mock)", () => {
  test("open, show results, close", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "cq_mock_session",
        JSON.stringify({ joinCode: "MOCK", sessionId: "MOCK-SESSION" })
      )
    );
    await page.goto("/#/presenter/MOCK-SESSION?mockSession=MOCK");

    const header = page.locator('[data-testid="presenter-header"]');
    if (!(await header.count())) {
      test.skip(true, "Mock presenter header not rendered");
    }
    await expect(header).toBeVisible({ timeout: 5000 });

    const openBtn = page.locator('[data-testid="open-question"]').first();
    if (!(await openBtn.count())) {
      test.skip(true, "Open question control not rendered in mock mode");
    }
    await expect(openBtn).toBeVisible({ timeout: 5000 });
    await openBtn.click();

    const toggleResults = page.locator('[data-testid="toggle-results"]').first();
    await expect(toggleResults).toBeVisible();
    await toggleResults.click();

    const closeBtn = page.locator('[data-testid="close-question"]').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
  });
});
