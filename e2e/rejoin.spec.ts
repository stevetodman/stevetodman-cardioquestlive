import { test, expect } from "./utils/fixtures";

test.describe("Rejoin last session", () => {
  test("shows rejoin button and navigates", async ({ page }) => {
    // Seed localStorage so the rejoin CTA renders regardless of previous runs.
    await page.addInitScript(() => {
      localStorage.setItem("cq_last_join_code", "ABCD");
    });

    await page.goto("/");

    const rejoin = page.getByRole("button", { name: /rejoin session abcd/i });
    await expect(rejoin).toBeVisible();

    await rejoin.click();
    await expect(page).toHaveURL(/#\/join\/ABCD/i);
  });
});
