/**
 * API contract tests — POST /api/webhooks/slack
 *
 * Prerequisites:
 *   Dev server must be running: npm run dev
 *   SLACK_SIGNING_SECRET must be set in .env.local (loaded by playwright.config.ts)
 *
 * Run with: npx playwright test --project=api tests/api/slack-webhook.test.ts
 */

import crypto from "crypto";
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const PATH = "/api/webhooks/slack";

function signBody(rawBody: string, timestamp: string, secret: string): string {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
}

test("POST /api/webhooks/slack — missing signature headers → 401", async ({ request }) => {
  const res = await request.post(`${BASE}${PATH}`, {
    headers: { "content-type": "application/json" },
    data: { type: "url_verification", challenge: "xyz" },
  });
  expect(res.status()).toBe(401);
});

test("POST /api/webhooks/slack — invalid signature → 401", async ({ request }) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const res = await request.post(`${BASE}${PATH}`, {
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": "v0=deadbeef",
    },
    data: { type: "url_verification", challenge: "xyz" },
  });
  expect(res.status()).toBe(401);
});

test("POST /api/webhooks/slack — stale timestamp → 401", async ({ request }) => {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  test.skip(!secret, "SLACK_SIGNING_SECRET not set in .env.local");

  const timestamp = (Math.floor(Date.now() / 1000) - 60 * 10).toString(); // 10 min ago
  const body = JSON.stringify({ type: "url_verification", challenge: "xyz" });
  const signature = signBody(body, timestamp, secret);
  const res = await request.post(`${BASE}${PATH}`, {
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    data: body,
  });
  expect(res.status()).toBe(401);
});

test("POST /api/webhooks/slack — url_verification echoes challenge", async ({ request }) => {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  test.skip(!secret, "SLACK_SIGNING_SECRET not set in .env.local");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    type: "url_verification",
    token: "verification-token",
    challenge: "challenge-string-123",
  });
  const signature = signBody(body, timestamp, secret);
  const res = await request.post(`${BASE}${PATH}`, {
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    data: body,
  });
  expect(res.status()).toBe(200);
  const payload = (await res.json()) as { challenge?: string };
  expect(payload.challenge).toBe("challenge-string-123");
});

test("POST /api/webhooks/slack — valid team_join with unmatched email → 200", async ({ request }) => {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  test.skip(!secret, "SLACK_SIGNING_SECRET not set in .env.local");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    type: "event_callback",
    event: {
      type: "team_join",
      user: {
        id: "U_TEST_NEVER_EXISTS",
        profile: {
          email: "no-matching-application-9f4e@example.com",
          real_name: "Test Unmatched",
        },
      },
    },
  });
  const signature = signBody(body, timestamp, secret);
  const res = await request.post(`${BASE}${PATH}`, {
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    data: body,
  });
  // Handler exits cleanly with `no_matching_application`; route returns 200.
  expect(res.status()).toBe(200);
});
