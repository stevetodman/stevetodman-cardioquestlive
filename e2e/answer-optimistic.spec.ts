import { test, expect } from "@playwright/test";

test.describe("Optimistic answer submission (UI)", () => {
  test("selection appears immediately", async ({ page }) => {
    await page.goto("/#/join/ANSWER?mockSession=ANSWER");

    const option = page.getByTestId("answer-option-0");
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await expect(option).toHaveClass(/selected|bg/i, { timeout: 1000 });
  });
});
