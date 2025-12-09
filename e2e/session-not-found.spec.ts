import { test, expect } from "./utils/fixtures";

test.describe("Session not found", () => {
  test("shows guidance when session missing", async ({ page }) => {
    await page.goto("/#/join/XXXX?mockNotFound=true");

    await expect(page.getByTestId("session-not-found")).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole("heading", { name: /session not found/i })).toBeVisible({ timeout: 2000 });

    const homeLink = page.getByRole("link", { name: /Home|Enter New Code|Back/i }).first();
    await homeLink.click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
