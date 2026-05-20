import { defineConfig } from "@playwright/test";

const webBaseUrl = process.env.SMOKE_WEB_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: "list",
  retries: 0,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: webBaseUrl,
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 960 },
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite --host localhost --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.SMOKE_WEB_URL,
    timeout: 120000,
  },
});
