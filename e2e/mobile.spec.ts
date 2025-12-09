import { test, expect } from "./utils/fixtures";

test.describe("Mobile layout", () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test("question card visible on mobile with mock session", async ({ page }) => {
    await page.goto("/#/join/MOBL?mockSession=MOBL&mockVoice=ready");

    await expect(page.getByText(/mock question/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/MOBL/i)).toBeVisible({ timeout: 5000 });
  });
});
