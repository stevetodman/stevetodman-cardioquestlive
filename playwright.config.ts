import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

const projects = [
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
];

// Chromium is disabled by default in this environment due to macOS sandbox/Crashpad
// permission issues. Set PLAYWRIGHT_USE_CHROMIUM=true to exercise the Chromium project.
if (process.env.PLAYWRIGHT_USE_CHROMIUM === "true") {
  projects.push({
    name: "chromium",
    // Use the system-installed Chrome to avoid sandbox limitations of the bundled headless shell.
    use: { ...devices["Desktop Chrome"], channel: "chrome" },
  });
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects,
});
