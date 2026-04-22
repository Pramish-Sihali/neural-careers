import { test, expect } from "@playwright/test";
import { MockSlackService } from "@/lib/integrations/slack/MockSlackService";

test("mock slack — lookupUserByEmail returns a deterministic user", async () => {
  const svc = new MockSlackService();
  const user = await svc.lookupUserByEmail("alice@example.com");
  expect(user).not.toBeNull();
  expect(user!.email).toBe("alice@example.com");
  expect(user!.id).toMatch(/^U[A-Z0-9]+$/);
});

test("mock slack — lookupUserByEmail returns null for the unknown marker email", async () => {
  const svc = new MockSlackService();
  const user = await svc.lookupUserByEmail("not-in-slack@example.com");
  expect(user).toBeNull();
});

test("mock slack — sendDM records the last call and returns ok", async () => {
  const svc = new MockSlackService();
  const res = await svc.sendDM("U123", "Hi Alice!");
  expect(res.ok).toBe(true);
  expect(svc.lastDM).toEqual({ userId: "U123", text: "Hi Alice!" });
});

test("mock slack — postChannelMessage returns ok", async () => {
  const svc = new MockSlackService();
  const res = await svc.postChannelMessage("C123", "Alice has joined!");
  expect(res.ok).toBe(true);
});
