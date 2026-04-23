import { test, expect } from "@playwright/test";
import { buildInvitePayload } from "@/lib/services/onboardingService";

test("buildInvitePayload — formats start date and supplies the invite URL", async () => {
  const payload = await buildInvitePayload({
    candidateName: "Alice Example",
    role: "Senior Engineer",
    startDateIso: "2026-05-03",
    slackInviteUrl: "https://join.slack.com/t/niural/shared_invite/zt-xxx",
  });
  expect(payload.subject).toContain("Welcome to Niural");
  expect(payload.html).toContain("Alice Example");
  expect(payload.html).toContain("Senior Engineer");
  expect(payload.html).toContain("May 3, 2026");
  expect(payload.html).toContain("zt-xxx");
});
