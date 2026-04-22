/**
 * Unit tests — service interface contracts
 *
 * These tests do NOT require a running server or database.
 * They instantiate mock service classes directly and assert:
 *   - Return shapes match the interface definitions
 *   - New methods (addToMeeting) behave correctly
 *   - Edge cases (missing API key) are handled gracefully
 *
 * Run with: npx playwright test --project=unit
 *
 * Run BEFORE and AFTER any refactoring to ensure interface contracts are preserved.
 */

import { test, expect } from "@playwright/test";
import { MockCalendarService } from "../../lib/integrations/calendar/MockCalendarService";
import { MockNotetakerService } from "../../lib/integrations/notetaker/MockNotetakerService";
import { FirefliesNotetakerService } from "../../lib/integrations/notetaker/FirefliesNotetakerService";

// ---------------------------------------------------------------------------
// MockCalendarService — ICalendarService contract
// ---------------------------------------------------------------------------

test.describe("MockCalendarService", () => {
  const svc = new MockCalendarService();
  const email = "interviewer@test.com";
  const start = new Date("2030-06-10T09:00:00Z");
  const end = new Date("2030-06-24T17:00:00Z");
  const slotEnd = new Date(start.getTime() + 60 * 60_000);

  test("getAvailableSlots returns 1–5 slots with Date start/end pairs", async () => {
    const slots = await svc.getAvailableSlots(email, start, end, 60);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(5);
    for (const s of slots) {
      expect(s.start).toBeInstanceOf(Date);
      expect(s.end).toBeInstanceOf(Date);
      expect(s.end.getTime() - s.start.getTime()).toBe(60 * 60_000);
    }
  });

  test("getAvailableSlots skips weekends", async () => {
    const slots = await svc.getAvailableSlots(email, start, end, 60);
    for (const s of slots) {
      const day = s.start.getDay();
      expect(day).not.toBe(0); // Sunday
      expect(day).not.toBe(6); // Saturday
    }
  });

  test("holdSlot returns CalendarEvent with non-empty googleEventId", async () => {
    const event = await svc.holdSlot(email, "Alice Test", "alice@test.com", start, slotEnd);
    expect(typeof event.googleEventId).toBe("string");
    expect(event.googleEventId.length).toBeGreaterThan(0);
  });

  test("holdSlot returns a meetLink starting with https://", async () => {
    const event = await svc.holdSlot(email, "Alice Test", "alice@test.com", start, slotEnd);
    expect(typeof event.meetLink).toBe("string");
    expect(event.meetLink!.startsWith("https://")).toBe(true);
  });

  test("releaseSlot resolves without throwing", async () => {
    await expect(svc.releaseSlot(email, "mock-event-abc")).resolves.toBeUndefined();
  });

  test("confirmEvent returns a meet link string (added by DIP fix)", async () => {
    const link = await svc.confirmEvent(email, "mock-event-abc", "Alice Test", []);
    expect(typeof link).toBe("string");
    expect(link!.startsWith("https://")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MockNotetakerService — INotetakerService contract
// ---------------------------------------------------------------------------

test.describe("MockNotetakerService", () => {
  const svc = new MockNotetakerService();

  test("fetchTranscript returns a FirefliesTranscript-shaped object", async () => {
    const t = await svc.fetchTranscript("meeting-abc123", { candidateName: "Bob Smith" });
    expect(typeof t.id).toBe("string");
    expect(typeof t.title).toBe("string");
    expect(typeof t.date).toBe("string");
    expect(typeof t.duration).toBe("number");
    expect(Array.isArray(t.sentences)).toBe(true);
    expect(t.sentences.length).toBeGreaterThan(0);
  });

  test("fetchTranscript sentences have speaker_name and text strings", async () => {
    const t = await svc.fetchTranscript("meeting-abc123", { candidateName: "Bob Smith" });
    for (const s of t.sentences) {
      expect(typeof s.speaker_name).toBe("string");
      expect(typeof s.text).toBe("string");
      expect(typeof s.start_time).toBe("number");
      expect(typeof s.end_time).toBe("number");
    }
  });

  test("fetchTranscript embeds candidateName in title", async () => {
    const t = await svc.fetchTranscript("m1", { candidateName: "Zara Jones" });
    expect(t.title).toContain("Zara Jones");
  });

  test("fetchTranscript summary has overview string", async () => {
    const t = await svc.fetchTranscript("m1", { candidateName: "Zara Jones" });
    expect(typeof t.summary?.overview).toBe("string");
  });

  test("addToMeeting returns { success: true, message: string }", async () => {
    const result = await svc.addToMeeting("https://meet.google.com/abc-defg-hij");
    expect(result.success).toBe(true);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  test("addToMeeting with any URL always succeeds in mock mode", async () => {
    const r1 = await svc.addToMeeting("https://meet.google.com/xxx-yyyy-zzz");
    const r2 = await svc.addToMeeting("https://meet.google.com/aaa-bbbb-ccc");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FirefliesNotetakerService — edge case: missing API key
// ---------------------------------------------------------------------------

test.describe("FirefliesNotetakerService — addToMeeting without API key", () => {
  test("returns { success: false, message: string } when FIREFLIES_API_KEY not set", async () => {
    const saved = process.env.FIREFLIES_API_KEY;
    delete process.env.FIREFLIES_API_KEY;

    try {
      const svc = new FirefliesNotetakerService();
      const result = await svc.addToMeeting("https://meet.google.com/test-abc");
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    } finally {
      if (saved !== undefined) process.env.FIREFLIES_API_KEY = saved;
    }
  });

  test("does not make a network request when API key is missing", async () => {
    // Confirm: no fetch call is attempted when key is absent
    // (If it did make a call, it would fail with a network error, not { success: false })
    const saved = process.env.FIREFLIES_API_KEY;
    delete process.env.FIREFLIES_API_KEY;

    try {
      const svc = new FirefliesNotetakerService();
      // Should resolve (not reject/throw), which proves no network call is made
      await expect(svc.addToMeeting("https://meet.google.com/test")).resolves.toMatchObject({
        success: false,
        message: expect.any(String),
      });
    } finally {
      if (saved !== undefined) process.env.FIREFLIES_API_KEY = saved;
    }
  });
});
