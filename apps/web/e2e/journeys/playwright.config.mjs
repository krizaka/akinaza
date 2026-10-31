// The critical journeys (krizaka-internal#1934/#1938, the org's journeys.yml: the required check `journeys / gate`). One Playwright project named
// `critical`, run as the seeded demo cast on the production build (scripts/ci-journeys-start.sh); films on, retries 0 (a flaky journey is a bug).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "../../../../test-results",
  reporter: [["list"], ["json"], ["html", { open: "never", outputFolder: "../../../../playwright-report" }]],
  workers: 1, // one test mailbox, one port
  retries: 0,
  timeout: 90_000,
  projects: [
    {
      name: "critical",
      testMatch: "**/*.critical.mjs",
      use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", video: "on", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
