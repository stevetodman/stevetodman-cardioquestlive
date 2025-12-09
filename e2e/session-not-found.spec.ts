import { test, expect } from "./utils/fixtures";

test.describe("Session not found", () => {
  test("shows guidance when session missing", async ({ page }) => {
    await page.goto("/#/join/XXXX?mockNotFound=true");

    const fallback = page.getByTestId("session-not-found").or(page.getByText(/session not found/i));
    await expect(fallback).toBeVisible({ timeout: 2000 });

    const homeLink = page.getByRole("link", { name: /Home|Enter New Code|Back/i }).first();
    await homeLink.click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
