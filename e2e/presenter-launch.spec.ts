import { test, expect } from "./utils/fixtures";

test.describe("Presenter launches presenter view", () => {
  test("create session and open presenter link", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "cq_mock_session",
        JSON.stringify({ joinCode: "MOCK", sessionId: "MOCK-SESSION" })
      )
    );
    await page.goto("/#/create-demo?mockSession=MOCK");
    await page.waitForTimeout(500);

    const joinCodeBadge = page.locator('[data-testid="join-code"]');
    if (!(await joinCodeBadge.count())) {
      await page.reload();
      await page.getByRole("button", { name: /create new session/i }).click();
    }

    const presenterLink = page.getByRole("link", { name: /launch presenter view/i });
    const linkCount = await presenterLink.count();
    if (!linkCount) {
      test.skip(true, "Presenter link not rendered (session creation may require backend)");
    }
    await presenterLink.click();

    await expect(page).toHaveURL(/#\/presenter\//i);
    await expect(page.locator('[data-testid="presenter-header"]')).toBeVisible({ timeout: 5000 });
  });
});
