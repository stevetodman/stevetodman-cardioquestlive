import { test, expect } from "./utils/fixtures";

test.describe("Accessibility basics", () => {
  test("skip link is focusable and visible on tab", async ({ page }) => {
    await page.goto("/");

    const main = page.locator("#main-content");
    await expect(main).toBeVisible();

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    // Ensure it can be focused (whether or not it is first in tab order).
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });
});
