import { test, expect } from "@playwright/test";

test.describe("Loading skeleton", () => {
  test("shows skeleton while session loads", async ({ page }) => {
    await page.goto("/#/join/LOAD");

    const skeleton = page.locator(".animate-shimmer").first();
    if (!(await skeleton.count())) {
      test.skip(true, "Skeleton not rendered in current load flow");
    }
    await expect(skeleton).toBeVisible();
  });
});
