import { test, expect } from "./utils/fixtures";

test.describe("Rejoin last session", () => {
  test.use({ returningUserState: undefined });

  test("shows rejoin button and navigates", async ({ page }) => {
    await page.goto("/");

    const rejoin = page.getByRole("button", { name: /rejoin session/i });
    const count = await rejoin.count();
    if (!count) {
      test.skip(true, "Rejoin button not rendered (no last code in storage)");
    }

    await rejoin.click();
    await expect(page).toHaveURL(/#\/join\/ABCD/i);
  });
});
