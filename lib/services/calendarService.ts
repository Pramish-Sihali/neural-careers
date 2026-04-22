import { supabase } from "@/lib/supabase";
import { parseApplicationRow, parseInterviewSlotRow } from "@/lib/types/database";
import { getCalendarService } from "@/lib/integrations/calendar";
import { GoogleCalendarService } from "@/lib/integrations/calendar/GoogleCalendarService";
import { signScheduleToken } from "@/lib/auth/scheduleToken";
import { getEmailService } from "@/lib/integrations/email";
import { renderInterviewInviteEmail } from "@/emails/InterviewInvite";

export async function getInterviewerEmail(): Promise<string> {
  if (process.env.USE_MOCK_CALENDAR === "true") {
    return process.env.INTERVIEWER_EMAIL ?? "interviewer@niural.com";
  }
  const { data, error } = await supabase
    .from("interviewer_credentials")
    .select("interviewerEmail")
    .limit(1)
    .maybeSingle();
  if (error) throw new SlotOfferError(error.message);
  if (!data) {
    throw new SlotOfferError(
      "No Google Calendar account connected. Visit http://localhost:3000/api/auth/google to connect."
    );
  }
  return (data as Record<string, unknown>).interviewerEmail as string;
}

const SLOT_DURATION_MINUTES = 60;
const HOLD_TTL_HOURS = 48;

export class SlotOfferError extends Error {}
export class SlotConfirmError extends Error {}

export async function offerInterviewSlots(
  applicationId: string,
  explicitSlots?: Array<{ start: Date; end: Date }>
): Promise<void> {
  const interviewerEmail = await getInterviewerEmail();

  const { data: appRaw, error: appError } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", applicationId)
    .single();

  if (appError) throw new SlotOfferError("Application not found");
  const application = parseApplicationRow(appRaw as Record<string, unknown>);

  if (application.status !== "SHORTLISTED") {
    throw new SlotOfferError("Application must be SHORTLISTED to offer slots");
  }

  // Release any previously held slots
  const { data: existingSlots } = await supabase
    .from("interview_slots")
    .select("id, googleEventId, interviewerEmail")
    .eq("applicationId", applicationId)
    .eq("status", "HELD");

  const calendar = getCalendarService();

  for (const slot of existingSlots ?? []) {
    const s = slot as { googleEventId: string | null; interviewerEmail: string };
    if (s.googleEventId) {
      await calendar.releaseSlot(s.interviewerEmail, s.googleEventId).catch(() => null);
    }
  }

  await supabase
    .from("interview_slots")
    .update({ status: "RELEASED", releasedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .eq("applicationId", applicationId)
    .eq("status", "HELD");

  let availableSlots: Array<{ start: Date; end: Date }>;

  if (explicitSlots && explicitSlots.length > 0) {
    availableSlots = explicitSlots;
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const twoWeeksOut = new Date(tomorrow.getTime() + 14 * 24 * 60 * 60 * 1000);

    availableSlots = await calendar.getAvailableSlots(
      interviewerEmail,
      tomorrow,
      twoWeeksOut,
      SLOT_DURATION_MINUTES
    );
  }

  if (availableSlots.length === 0) {
    throw new SlotOfferError("No available slots found");
  }

  const holdExpiresAt = new Date(Date.now() + HOLD_TTL_HOURS * 60 * 60 * 1000);
  const now = new Date().toISOString();

  const createdSlots = await Promise.all(
    availableSlots.map(async (slot) => {
      const event = await calendar.holdSlot(
        interviewerEmail,
        application.candidateName,
        application.candidateEmail,
        slot.start,
        slot.end
      );

      const { data: row, error } = await supabase
        .from("interview_slots")
        .insert({
          id: crypto.randomUUID(),
          applicationId,
          interviewerEmail,
          startTime: slot.start.toISOString(),
          endTime: slot.end.toISOString(),
          status: "HELD",
          googleEventId: event.googleEventId,
          holdExpiresAt: holdExpiresAt.toISOString(),
          createdAt: now,
          updatedAt: now,
        })
        .select()
        .single();

      if (error) throw error;
      return parseInterviewSlotRow(row as Record<string, unknown>);
    })
  );

  const token = await signScheduleToken(applicationId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const html = renderInterviewInviteEmail({
    candidateName: application.candidateName,
    jobTitle: application.job!.title,
    slots: createdSlots.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      confirmUrl: `${appUrl}/api/schedule/confirm?token=${token}&slotId=${s.id}`,
    })),
  });

  await getEmailService().send({
    to: application.candidateEmail,
    subject: `Interview invitation — ${application.job!.title}`,
    html,
  });

  await supabase.from("events_log").insert({
    id: crypto.randomUUID(),
    applicationId,
    eventType: "SLOTS_OFFERED",
    payload: { slotCount: createdSlots.length, interviewerEmail },
    idempotencyKey: `slots-offered:${applicationId}:${holdExpiresAt.getTime()}`,
    createdAt: now,
  });
}

export async function confirmInterviewSlot(
  applicationId: string,
  slotId: string
): Promise<void> {
  const interviewerEmail = await getInterviewerEmail();

  const { data: slotRaw, error: slotError } = await supabase
    .from("interview_slots")
    .select("*, application:applications(*, job:jobs(*))")
    .eq("id", slotId)
    .single();

  if (slotError) throw new SlotConfirmError("Slot not found");
  const slot = parseInterviewSlotRow(slotRaw as Record<string, unknown>);

  if (slot.applicationId !== applicationId) throw new SlotConfirmError("Slot does not belong to this application");
  if (slot.status !== "HELD") throw new SlotConfirmError("Slot is no longer available");

  const now = new Date();
  if (slot.holdExpiresAt < now) throw new SlotConfirmError("Slot has expired");

  // Release all other HELD slots for this application
  const { data: otherSlotsRaw } = await supabase
    .from("interview_slots")
    .select("id, googleEventId, interviewerEmail")
    .eq("applicationId", applicationId)
    .eq("status", "HELD")
    .neq("id", slotId);

  const calendar = getCalendarService();

  await Promise.all(
    (otherSlotsRaw ?? []).map((s: Record<string, unknown>) =>
      s.googleEventId
        ? calendar.releaseSlot(s.interviewerEmail as string, s.googleEventId as string).catch(() => null)
        : Promise.resolve()
    )
  );

  await supabase
    .from("interview_slots")
    .update({ status: "RELEASED", releasedAt: now.toISOString(), updatedAt: now.toISOString() })
    .eq("applicationId", applicationId)
    .eq("status", "HELD")
    .neq("id", slotId);

  await supabase
    .from("interview_slots")
    .update({ status: "CONFIRMED", confirmedAt: now.toISOString(), updatedAt: now.toISOString() })
    .eq("id", slotId);

  let meetLink: string | undefined;
  if (slot.googleEventId && calendar instanceof GoogleCalendarService) {
    const additionalAttendees =
      process.env.USE_MOCK_NOTETAKER !== "true"
        ? ["fireflies.ai@fireflies.ai"]
        : [];

    meetLink = await calendar
      .confirmEvent(
        interviewerEmail,
        slot.googleEventId,
        slot.application!.candidateName,
        additionalAttendees
      )
      .catch(() => undefined);
  }

  const nowIso = now.toISOString();

  await supabase.from("interviews").insert({
    id: crypto.randomUUID(),
    applicationId,
    slotId,
    status: "SCHEDULED",
    scheduledAt: slot.startTime.toISOString(),
    ...(meetLink ? { meetingUrl: meetLink } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await supabase
    .from("applications")
    .update({ status: "INTERVIEWING", updatedAt: nowIso })
    .eq("id", applicationId);

  await supabase.from("events_log").insert({
    id: crypto.randomUUID(),
    applicationId,
    eventType: "SLOT_CONFIRMED",
    payload: {
      slotId,
      startTime: slot.startTime.toISOString(),
      interviewerEmail,
    },
    idempotencyKey: `slot-confirmed:${slotId}`,
    createdAt: nowIso,
  });

  const app = slot.application!;
  await getEmailService().send({
    to: app.candidateEmail,
    subject: `Interview confirmed — ${app.job!.title}`,
    html: buildConfirmationHtml(
      app.candidateName,
      app.job!.title,
      slot.startTime,
      slot.endTime
    ),
  });
}

function buildConfirmationHtml(
  name: string,
  jobTitle: string,
  start: Date,
  end: Date
): string {
  const fmt = (d: Date) =>
    d.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return `
<div style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="margin:0 0 16px;color:#111827;">Interview confirmed</h2>
  <p style="color:#374151;">Hi ${name},</p>
  <p style="color:#374151;">Your interview for <strong>${jobTitle}</strong> has been confirmed.</p>
  <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:24px 0;">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Date &amp; Time</p>
    <p style="margin:0;font-size:15px;color:#111827;font-weight:500;">${fmt(start)}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Duration: ${Math.round((end.getTime() - start.getTime()) / 60000)} minutes</p>
  </div>
  <p style="color:#374151;">You will receive a calendar invite shortly with a meeting link. Please be ready 5 minutes before the scheduled time.</p>
  <hr style="border-color:#e5e7eb;margin:32px 0 24px;"/>
  <p style="font-size:12px;color:#9ca3af;">Niural automated hiring system — please do not reply to this email.</p>
</div>`;
}
