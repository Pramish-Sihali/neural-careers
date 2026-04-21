import { prisma } from "@/lib/prisma";
import { getCalendarService } from "@/lib/integrations/calendar";
import { signScheduleToken } from "@/lib/auth/scheduleToken";
import { getEmailService } from "@/lib/integrations/email";
import { renderInterviewInviteEmail } from "@/emails/InterviewInvite";

const INTERVIEWER_EMAIL =
  process.env.INTERVIEWER_EMAIL ?? "interviewer@niural.com";

const SLOT_DURATION_MINUTES = 60;
const HOLD_TTL_HOURS = 48;

export class SlotOfferError extends Error {}
export class SlotConfirmError extends Error {}

export async function offerInterviewSlots(applicationId: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!application) throw new SlotOfferError("Application not found");
  if (application.status !== "SHORTLISTED") {
    throw new SlotOfferError("Application must be SHORTLISTED to offer slots");
  }

  // Release any previously held slots before offering new ones
  const existing = await prisma.interviewSlot.findMany({
    where: { applicationId, status: "HELD" },
  });

  const calendar = getCalendarService();

  for (const slot of existing) {
    if (slot.googleEventId) {
      await calendar.releaseSlot(INTERVIEWER_EMAIL, slot.googleEventId).catch(() => null);
    }
  }

  await prisma.interviewSlot.updateMany({
    where: { applicationId, status: "HELD" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  // Generate 5 fresh slots starting tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const twoWeeksOut = new Date(tomorrow.getTime() + 14 * 24 * 60 * 60 * 1000);

  const availableSlots = await calendar.getAvailableSlots(
    INTERVIEWER_EMAIL,
    tomorrow,
    twoWeeksOut,
    SLOT_DURATION_MINUTES
  );

  if (availableSlots.length === 0) {
    throw new SlotOfferError("No available slots found");
  }

  const holdExpiresAt = new Date(Date.now() + HOLD_TTL_HOURS * 60 * 60 * 1000);

  // Create hold events and DB rows
  const createdSlots = await Promise.all(
    availableSlots.map(async (slot) => {
      const event = await calendar.holdSlot(
        INTERVIEWER_EMAIL,
        application.candidateName,
        application.candidateEmail,
        slot.start,
        slot.end
      );

      return prisma.interviewSlot.create({
        data: {
          applicationId,
          interviewerEmail: INTERVIEWER_EMAIL,
          startTime: slot.start,
          endTime: slot.end,
          status: "HELD",
          googleEventId: event.googleEventId,
          holdExpiresAt,
        },
      });
    })
  );

  // Sign a schedule JWT for the candidate
  const token = await signScheduleToken(applicationId);
  const scheduleUrl = `${process.env.NEXT_PUBLIC_APP_URL}/schedule/${token}`;

  // Send slot-offer email
  const html = renderInterviewInviteEmail({
    candidateName: application.candidateName,
    jobTitle: application.job.title,
    slots: createdSlots.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
    })),
    scheduleUrl,
  });

  await getEmailService().send({
    to: application.candidateEmail,
    subject: `Interview invitation — ${application.job.title}`,
    html,
  });

  // Log event
  await prisma.eventsLog.create({
    data: {
      applicationId,
      eventType: "SLOTS_OFFERED",
      payload: { slotCount: createdSlots.length, interviewerEmail: INTERVIEWER_EMAIL },
      idempotencyKey: `slots-offered:${applicationId}:${holdExpiresAt.getTime()}`,
    },
  });
}

export async function confirmInterviewSlot(
  applicationId: string,
  slotId: string
): Promise<void> {
  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    include: { application: { include: { job: true } } },
  });

  if (!slot) throw new SlotConfirmError("Slot not found");
  if (slot.applicationId !== applicationId) throw new SlotConfirmError("Slot does not belong to this application");
  if (slot.status !== "HELD") throw new SlotConfirmError("Slot is no longer available");

  const now = new Date();
  if (slot.holdExpiresAt < now) throw new SlotConfirmError("Slot has expired");

  // Release all other HELD slots for this application
  const otherSlots = await prisma.interviewSlot.findMany({
    where: { applicationId, status: "HELD", id: { not: slotId } },
  });

  const calendar = getCalendarService();

  await Promise.all(
    otherSlots.map((s) =>
      s.googleEventId
        ? calendar.releaseSlot(INTERVIEWER_EMAIL, s.googleEventId).catch(() => null)
        : Promise.resolve()
    )
  );

  await prisma.interviewSlot.updateMany({
    where: { applicationId, status: "HELD", id: { not: slotId } },
    data: { status: "RELEASED", releasedAt: now },
  });

  // Confirm the chosen slot
  await prisma.interviewSlot.update({
    where: { id: slotId },
    data: { status: "CONFIRMED", confirmedAt: now },
  });

  // Create Interview record
  await prisma.interview.create({
    data: {
      applicationId,
      slotId,
      status: "SCHEDULED",
      scheduledAt: slot.startTime,
    },
  });

  // Advance application status
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "INTERVIEWING" },
  });

  // Log event
  await prisma.eventsLog.create({
    data: {
      applicationId,
      eventType: "SLOT_CONFIRMED",
      payload: {
        slotId,
        startTime: slot.startTime.toISOString(),
        interviewerEmail: INTERVIEWER_EMAIL,
      },
      idempotencyKey: `slot-confirmed:${slotId}`,
    },
  });

  // Confirmation email to candidate
  const app = slot.application;
  await getEmailService().send({
    to: app.candidateEmail,
    subject: `Interview confirmed — ${app.job.title}`,
    html: buildConfirmationHtml(
      app.candidateName,
      app.job.title,
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
