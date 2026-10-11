import { defineConfig, devices } from "@playwright/test";

// Browser tests for the admin (Next.js, :3000) and the member app (Expo web,
// :8081). Both servers are started if they aren't already running. Tests use
// a throwaway gym and accounts (tests/e2e/global-setup.ts), so they share
// state and run one at a time.
//   npm run test:e2e
//   npm run test:e2e -- --ui      (watch them run)

const ci = !!process.env.CI;
// Locally use the installed Edge; CI installs Playwright's Chromium.
const browser = ci ? {} : { channel: "msedge" as const };

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  workers: 1,
  fullyParallel: false,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: ci ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...browser,
  },
  projects: [
    {
      name: "admin",
      testMatch: "admin/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], ...browser, baseURL: "http://localhost:3000", viewport: { width: 1366, height: 900 } },
    },
    {
      name: "app",
      testMatch: "app/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], ...browser, baseURL: "http://localhost:8081", viewport: { width: 400, height: 860 } },
    },
  ],
  webServer: [
    { command: "npm run web", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 240_000 },
    { command: "npm run mobile:web", url: "http://localhost:8081", reuseExistingServer: true, timeout: 240_000, env: { CI: "1" } },
  ],
});
