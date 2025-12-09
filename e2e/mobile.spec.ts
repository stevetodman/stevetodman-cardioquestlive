import { test, expect } from "./utils/fixtures";

test.describe("Mobile layout", () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test("question card visible on mobile with mock session", async ({ page }) => {
    await page.goto("/#/join/MOBL?mockSession=MOBL");

    await expect(page.getByText(/Mock Session/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Mock question/i)).toBeVisible({ timeout: 3000 });
  });
});
