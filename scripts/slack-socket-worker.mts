// scripts/slack-socket-worker.ts
// Standalone Node worker — runs the Slack Bolt Socket Mode listener.
// Start with: npm run slack:worker

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

if (process.env.USE_MOCK_SLACK === "true") {
  console.error("USE_MOCK_SLACK=true — worker not needed in mock mode. Exiting.");
  process.exit(0);
}

const { buildBoltApp } = await import("@/lib/slack/boltApp");

const app = buildBoltApp();
await app.start();
console.log("✅ Slack Socket Mode worker is running. Listening for team_join events.");

process.on("SIGINT", async () => {
  console.log("\nShutting down Slack worker…");
  try { await app.stop(); } catch { /* noop */ }
  process.exit(0);
});
