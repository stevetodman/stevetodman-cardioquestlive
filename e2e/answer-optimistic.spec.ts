import { test, expect } from "@playwright/test";

test.describe("Optimistic answer submission (UI)", () => {
  test("selection appears immediately", async ({ page }) => {
    await page.goto("/#/join/ANSWER?mockSession=ANSWER");

    const option = page.getByRole("button", { name: /A\)|B\)|C\)|D\)/i }).first();
    await option.click();
    await expect(option).toHaveClass(/selected|bg/i, { timeout: 1000 });
  });
});
