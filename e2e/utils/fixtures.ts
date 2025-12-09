import { test as base, expect, Request } from "@playwright/test";
import fs from "fs";
import path from "path";

// Simple storage state fixture to simulate a returning user with last join code.
export const test = base.extend<{
  returningUserState: void;
  stubFirestore: (handler: (route: Request) => Promise<unknown> | unknown) => Promise<void>;
  loadFixture: (name: string) => any;
  forceVoiceReady: void;
}>({
  returningUserState: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("cq_last_join_code", "ABCD");
    });
    await use();
    await page.addInitScript(() => {
      localStorage.removeItem("cq_last_join_code");
    });
  },
  stubFirestore: async ({ page }, use) => {
    const routeHandler = async (route: any, handler: (request: Request) => Promise<unknown> | unknown) => {
      if (route.request().url().includes("firestore.googleapis.com")) {
        const result = await handler(route.request());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(result ?? {}),
        });
      } else {
        await route.continue();
      }
    };

    await page.route("**/*", (route) => routeHandler(route, () => ({})));
    await use(routeHandler as any);
    await page.unroute("**/*");
  },
  loadFixture: async ({}, use) => {
    const loader = (name: string) => {
      const p = path.join(process.cwd(), "e2e", "fixtures", name);
      const data = fs.readFileSync(p, "utf8");
      return JSON.parse(data);
    };
    await use(loader);
  },
  forceVoiceReady: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "cq_voice_mock_state",
        JSON.stringify({
          enabled: true,
          status: "ready",
        })
      );
    });
    await use();
    await page.addInitScript(() => {
      localStorage.removeItem("cq_voice_mock_state");
    });
  },
});

// Re-export expect for convenience in specs.
export { expect } from "@playwright/test";
