import { test, expect } from "@playwright/test";

test.describe("Presenter creates session and participant answers", () => {
  test("end-to-end happy path (mocked)", async ({ browser }) => {
    // Use the mocked create-demo route so we don't hit real Firestore.
    const presenter = await browser.newPage();
    await presenter.goto("/#/create-demo?mockSession=MOCK");

    // Join code should be available immediately from the mock.
    const joinCodeBadge = presenter.locator('[data-testid="join-code"]');
    await expect(joinCodeBadge).toBeVisible({ timeout: 5000 });
    const codeText = await joinCodeBadge.innerText();
    const codeMatch = codeText.match(/([A-Z0-9]{4})/i);
    const joinCode = codeMatch ? codeMatch[1] : "MOCK";

    // Launch presenter view for the mock session.
    const presenterLink = presenter.getByRole("link", { name: /launch presenter view/i });
    if (await presenterLink.count()) {
      await presenterLink.click();
      await expect(presenter).toHaveURL(/#\/presenter\//i);
    }

    // Participant joins and answers a question.
    const participant = await browser.newPage();
    await participant.goto(`/#/join/${joinCode}?mockSession=MOCK`);

    const option = participant.getByTestId("answer-option-0");
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await expect(option).toHaveClass(/selected|bg/i, { timeout: 1000 });

    // Presenter sees responses header in mock view.
    const responsesIndicator = presenter.getByText(/responses/i).first();
    await expect(responsesIndicator).toBeVisible({ timeout: 5000 });

    await participant.close();
    await presenter.close();
  });
});
