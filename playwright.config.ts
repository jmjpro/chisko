import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    // Playwright launches Chromium with --lang=en-US by default, which sets
    // Accept-Language at the browser-process level and wins over
    // extraHTTPHeaders for navigation requests. Now that the dev server
    // mimics production locale-redirect middleware (CHI-84), that default
    // triggers a real redirect. Pin locale to Hebrew, the app's default, to
    // match the suite's long-standing assumption that unprefixed routes
    // serve Hebrew.
    locale: "he-IL",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
