import { test, expect } from "./utils/fixtures";

test.describe("Home to Join (happy path)", () => {
  test("student enters code and navigates to join page", async ({ page }) => {
    await page.goto("/");

    const joinInput = page.getByLabel("Student Join");
    await expect(joinInput).toBeVisible();

    await joinInput.fill("ab1d");
    await expect(joinInput).toHaveValue("AB1D");

    const joinButton = page.getByRole("button", { name: /join/i });
    await expect(joinButton).toBeEnabled();

    await joinButton.click();
    await expect(page).toHaveURL(/#\/join\/AB1D/i);
  });
});
