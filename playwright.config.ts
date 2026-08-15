import { defineConfig, devices } from "@playwright/test";

const defaultBaseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    navigationTimeout: 90_000,
  },
  projects: process.env.PLAYWRIGHT_BROWSER_MATRIX === "true"
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      // Playwright launches Next in dev mode even when the isolated backend
      // process uses NODE_ENV=test. Keep the dev server's diagnostics/CSP
      // behavior aligned with the server mode under test.
      NODE_ENV: "development",
      SENTRY_ENABLED: "false",
    },
  },
});
