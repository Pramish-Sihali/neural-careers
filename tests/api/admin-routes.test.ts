/**
 * API contract tests — admin routes
 *
 * Prerequisites:
 *   Dev server must be running: npm run dev
 *   ADMIN_SECRET must be set (loaded from .env.local via playwright.config.ts)
 *
 * Run with: npx playwright test --project=api
 *
 * These tests verify the HTTP contract of admin routes:
 *   - Auth guard returns 401 with { error: string } when no Bearer token supplied
 *   - Error responses consistently use { error: string } shape
 *   - trigger-notetaker returns expected status codes for known failure cases
 *   - Fireflies webhook rejects bad signatures
 *
 * Run BEFORE and AFTER any refactoring to ensure nothing is broken.
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

function auth() {
  const secret = process.env.ADMIN_SECRET ?? "";
  return { Authorization: `Bearer ${secret}` };
}

// A UUID that will never exist in the database
const FAKE_ID = "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// 1. Auth guard — every protected route must reject requests without a token
// ---------------------------------------------------------------------------

test.describe("Admin API — auth guard", () => {
  const routes: { method: "get" | "post" | "patch"; path: string }[] = [
    { method: "get",   path: `/api/admin/applications` },
    { method: "get",   path: `/api/admin/applications/${FAKE_ID}` },
    { method: "post",  path: `/api/admin/applications/${FAKE_ID}/screen` },
    { method: "post",  path: `/api/admin/applications/${FAKE_ID}/shortlist` },
    { method: "patch", path: `/api/admin/applications/${FAKE_ID}/status` },
    { method: "post",  path: `/api/admin/applications/${FAKE_ID}/trigger-notetaker` },
    { method: "post",  path: `/api/admin/applications/${FAKE_ID}/simulate-interview` },
  ];

  for (const { method, path } of routes) {
    test(`${method.toUpperCase()} ${path} → 401 without token + { error: string }`, async ({ request }) => {
      const res = await request[method](`${BASE}${path}`);
      expect(res.status()).toBe(401);
      const body = await res.json() as unknown;
      expect(body).toMatchObject({ error: expect.any(String) });
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Not-found shape — authenticated requests for non-existent resources
//    must return { error: string }, never crash or return empty body
// ---------------------------------------------------------------------------

test.describe("Admin API — 404 response shape", () => {
  test("GET /api/admin/applications/:fakeId → 404 { error: string }", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/applications/${FAKE_ID}`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("POST /api/admin/applications/:fakeId/trigger-notetaker → 404 { error: string }", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/applications/${FAKE_ID}/trigger-notetaker`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("POST /api/admin/applications/:fakeId/screen → 4xx { error: string }", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/applications/${FAKE_ID}/screen`, {
      headers: auth(),
    });
    // DB returns not-found → 500 with "Application … not found" or 404 depending on route
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("POST /api/admin/applications/:fakeId/shortlist → 404 { error: string }", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/applications/${FAKE_ID}/shortlist`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("POST /api/admin/applications/:fakeId/simulate-interview → 404 { error: string }", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/applications/${FAKE_ID}/simulate-interview`, {
      headers: auth(),
    });
    expect(res.status()).toBe(404);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// 3. status route — invalid status value → 422 { error: string }
// ---------------------------------------------------------------------------

test.describe("Admin API — status route validation", () => {
  test("PATCH /api/admin/applications/:id/status with invalid status → 422 { error: string }", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/admin/applications/${FAKE_ID}/status`, {
      headers: { ...auth(), "content-type": "application/json" },
      data: JSON.stringify({ status: "NOT_A_REAL_STATUS" }),
    });
    expect(res.status()).toBe(422);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("PATCH /api/admin/applications/:id/status with missing status → 422 { error: string }", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/admin/applications/${FAKE_ID}/status`, {
      headers: { ...auth(), "content-type": "application/json" },
      data: JSON.stringify({}),
    });
    expect(res.status()).toBe(422);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// 4. trigger-notetaker specific contract
// ---------------------------------------------------------------------------

test.describe("trigger-notetaker route", () => {
  test("POST without auth → 401 { error: string }", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/applications/${FAKE_ID}/trigger-notetaker`);
    expect(res.status()).toBe(401);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("POST with valid auth + fake app → 404 { error: string }", async ({ request }) => {
    const res = await request.post(
      `${BASE}/api/admin/applications/${FAKE_ID}/trigger-notetaker`,
      { headers: auth() }
    );
    expect(res.status()).toBe(404);
    const body = await res.json() as unknown;
    expect(body).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// 5. Fireflies webhook — bad signature must be rejected
// ---------------------------------------------------------------------------

test.describe("Fireflies webhook", () => {
  test("POST /api/webhooks/fireflies with invalid signature → 403", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/fireflies`, {
      headers: {
        "content-type": "application/json",
        "x-hub-signature": "sha256=invalidsignature",
      },
      data: JSON.stringify({ event_type: "Transcription completed", meetingId: "test-id" }),
    });
    // 403 forbidden (bad signature) or 401
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/webhooks/fireflies with no signature → 403", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/fireflies`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ event_type: "Transcription completed", meetingId: "test-id" }),
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// 6. Public job routes — must not require auth
// ---------------------------------------------------------------------------

test.describe("Public API — no auth required", () => {
  test("GET /api/jobs → 200 with jobs array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/jobs`);
    expect(res.status()).toBe(200);
    const body = await res.json() as unknown;
    // Returns { jobs: [...] }
    expect(body).toMatchObject({ jobs: expect.any(Array) });
  });
});
