import { test, expect } from "@playwright/test";

test("resend-slack-invite — 401 without bearer", async ({ request }) => {
  const res = await request.post("/api/admin/applications/fake-id/resend-slack-invite");
  expect(res.status()).toBe(401);
});

test("resend-slack-invite — 404 for unknown application with valid bearer", async ({ request }) => {
  const res = await request.post("/api/admin/applications/00000000-0000-0000-0000-000000000000/resend-slack-invite", {
    headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
  });
  expect([404, 400]).toContain(res.status());
});
