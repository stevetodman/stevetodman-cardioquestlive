import { test, expect } from "@playwright/test";

test.describe("Student join flow (smoke)", () => {
  test("home page loads and shows join input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/cardioquest live/i)).toBeVisible();
    await expect(page.getByLabel(/student join/i)).toBeVisible();
    await expect(page.getByPlaceholder(/code/i)).toBeVisible();
  });
});
