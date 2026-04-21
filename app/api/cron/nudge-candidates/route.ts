import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/integrations/email";
import { signScheduleToken } from "@/lib/auth/scheduleToken";

// Sends a reminder email to candidates who received slots 24h ago but haven't picked yet.
// Called by Vercel Cron every hour.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
  const expirySoon = new Date(Date.now() + 4 * 60 * 60 * 1000); // expires within 4h

  // Find applications with HELD slots offered 24h+ ago, not yet confirmed
  const applications = await prisma.application.findMany({
    where: {
      status: "SHORTLISTED",
      interviewSlots: {
        some: {
          status: "HELD",
          createdAt: { lt: cutoff },
          holdExpiresAt: { gt: expirySoon }, // still has time left
        },
      },
    },
    include: {
      job: true,
      interviewSlots: {
        where: { status: "HELD" },
        orderBy: { startTime: "asc" },
      },
    },
  });

  let nudged = 0;

  for (const app of applications) {
    // Skip if already nudged
    const alreadyNudged = await prisma.scheduledNudge.findUnique({
      where: {
        applicationId_nudgeType: {
          applicationId: app.id,
          nudgeType: "SLOT_SELECTION_24H",
        },
      },
    });
    if (alreadyNudged?.sentAt) continue;

    try {
      const scheduleToken = await signScheduleToken(app.id);
      const scheduleUrl = `${process.env.NEXT_PUBLIC_APP_URL}/schedule/${scheduleToken}`;

      await getEmailService().send({
        to: app.candidateEmail,
        subject: `Reminder: choose your interview time — ${app.job.title}`,
        html: buildNudgeHtml(app.candidateName, app.job.title, scheduleUrl),
      });

      await prisma.scheduledNudge.upsert({
        where: {
          applicationId_nudgeType: {
            applicationId: app.id,
            nudgeType: "SLOT_SELECTION_24H",
          },
        },
        create: {
          applicationId: app.id,
          nudgeType: "SLOT_SELECTION_24H",
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
        update: { sentAt: new Date() },
      });

      nudged++;
    } catch (err) {
      console.error(`Nudge failed for ${app.id}:`, err);
    }
  }

  return NextResponse.json({ nudged });
}

function buildNudgeHtml(name: string, jobTitle: string, scheduleUrl: string): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="margin:0 0 16px;color:#111827;">Don't miss your interview slot</h2>
  <p style="color:#374151;">Hi ${name},</p>
  <p style="color:#374151;">
    Just a reminder — we sent you interview time options for <strong>${jobTitle}</strong>
    at Niural 24 hours ago and haven't heard back yet.
  </p>
  <p style="color:#374151;">Your slots expire soon. Please choose a time before they're released:</p>
  <a href="${scheduleUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;margin:16px 0;">
    Choose your interview time →
  </a>
  <p style="margin-top:24px;font-size:13px;color:#6b7280;">
    If none of the times work, reply to this email and we'll arrange something else.
  </p>
  <hr style="border-color:#e5e7eb;margin:32px 0 24px;"/>
  <p style="font-size:12px;color:#9ca3af;">Niural automated hiring system.</p>
</div>`;
}
