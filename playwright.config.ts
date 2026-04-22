import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local so ADMIN_SECRET etc. are available in API tests
config({ path: ".env.local" });

export default defineConfig({
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  projects: [
    // ── E2E browser tests (existing) ──────────────────────────────────────
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
        headless: true,
        screenshot: "only-on-failure",
        video: "retain-on-failure",
      },
    },

    // ── API contract tests (HTTP requests only, no browser) ───────────────
    // Prerequisites: npm run dev
    {
      name: "api",
      testDir: "./tests/api",
      use: {
        baseURL: "http://localhost:3000",
      },
    },

    // ── Unit tests (pure Node.js, no server, no browser) ──────────────────
    {
      name: "unit",
      testDir: "./tests/unit",
      use: {},
    },
  ],
  // No webServer block — start the dev server manually before running tests
});
