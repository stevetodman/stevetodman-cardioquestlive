import { test, expect } from "./utils/fixtures";

test.describe("Join flow", () => {
  test("enforces uppercase, length, and shows validation hint", async ({ page }) => {
    await page.goto("/");

    const input = page.getByLabel("Student Join");
    await expect(input).toBeVisible();

    await input.fill("ab1d");
    await expect(input).toHaveValue("AB1D");

    // When complete, join button enabled and checkmark visible.
    const joinButton = page.getByRole("button", { name: "Join" });
    await expect(joinButton).toBeEnabled();
    await expect(page.getByText("✓")).toBeVisible();

    // Submit should navigate to join route.
    await joinButton.click();
    await expect(page).toHaveURL(/#\/join\/AB1D/i);
  });

  test("shows rejoin button when last code exists", async ({ page, returningUserState }) => {
    void returningUserState; // ensures fixture runs
    await page.goto("/");

    const rejoin = page.getByRole("button", { name: /rejoin session abcd/i });
    await expect(rejoin).toBeVisible();

    await rejoin.click();
    await expect(page).toHaveURL(/#\/join\/ABCD/i);
  });
});
