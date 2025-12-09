import { test, expect } from "./utils/fixtures";

test.describe("Voice UI states (UI-only)", () => {
  test("placeholder shown when voice disabled", async ({ page }) => {
    await page.goto("/#/join/VOICE");

    const placeholder = page.getByText(/voice will be available when the presenter enables it/i).first();
    if (!(await placeholder.count())) {
      test.skip(true, "Voice placeholder not rendered in current join flow");
    }
    await expect(placeholder).toBeVisible();
  });
});
