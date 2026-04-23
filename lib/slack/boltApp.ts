// lib/slack/boltApp.ts
import { App, LogLevel } from "@slack/bolt";
import { handleTeamJoin } from "@/lib/services/onboardingService";

/**
 * Returns a configured Bolt app (Socket Mode). Never call this in mock mode —
 * Socket Mode opens a real WebSocket to Slack.
 */
export function buildBoltApp(): App {
  const token          = requireEnv("SLACK_BOT_TOKEN");
  const signingSecret  = requireEnv("SLACK_SIGNING_SECRET");
  const appToken       = requireEnv("SLACK_APP_TOKEN");

  const app = new App({
    token, signingSecret, appToken,
    socketMode: true,
    logLevel: (process.env.SLACK_LOG_LEVEL as LogLevel | undefined) ?? LogLevel.INFO,
  });

  app.event("team_join", async ({ event }) => {
    // Slack typings are loose here — narrow carefully.
    const user = (event as { user?: { id?: string; profile?: { email?: string; real_name?: string } } }).user;
    const email    = user?.profile?.email;
    const userId   = user?.id;
    const realName = user?.profile?.real_name ?? "";
    if (!email || !userId) {
      console.warn("[team_join] missing email or id", { event });
      return;
    }

    try {
      const res = await handleTeamJoin({ slackUserId: userId, email, realName });
      console.log("[team_join] handled", { email, ...res });
    } catch (err) {
      console.error("[team_join] handler error", err);
    }
  });

  // Error handler — keep the socket alive through transient failures.
  app.error(async (err) => {
    console.error("[bolt] error", err);
  });

  return app;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required to run the Slack Socket Mode worker`);
  return v;
}
