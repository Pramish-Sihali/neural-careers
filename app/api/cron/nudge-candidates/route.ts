import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import { getEmailService } from "@/lib/integrations/email";
import { signScheduleToken } from "@/lib/auth/scheduleToken";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const expirySoon = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  // Step 1: find HELD slots offered 24h+ ago that still have time left
  const { data: matchingSlots, error: slotsError } = await supabase
    .from("interview_slots")
    .select("applicationId")
    .eq("status", "HELD")
    .lt("createdAt", cutoff)
    .gt("holdExpiresAt", expirySoon);

  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 });

  const qualifyingIds = [...new Set(
    (matchingSlots ?? []).map((s) => (s as Record<string, unknown>).applicationId as string)
  )];

  if (qualifyingIds.length === 0) {
    return NextResponse.json({ nudged: 0 });
  }

  // Step 2: get SHORTLISTED applications in that set, with their job and held slots
  const { data: appsRaw, error: appsError } = await supabase
    .from("applications")
    .select("*, job:jobs(*), interviewSlots:interview_slots(*)")
    .eq("status", "SHORTLISTED")
    .in("id", qualifyingIds);

  if (appsError) return NextResponse.json({ error: appsError.message }, { status: 500 });

  let nudged = 0;

  for (const raw of appsRaw ?? []) {
    const app = parseApplicationRow(raw as Record<string, unknown>);

    const { data: alreadyNudged } = await supabase
      .from("scheduled_nudges")
      .select("sentAt")
      .eq("applicationId", app.id)
      .eq("nudgeType", "SLOT_SELECTION_24H")
      .maybeSingle();

    if ((alreadyNudged as Record<string, unknown> | null)?.sentAt) continue;

    try {
      const scheduleToken = await signScheduleToken(app.id);
      const scheduleUrl = `${process.env.NEXT_PUBLIC_APP_URL}/schedule/${scheduleToken}`;

      await getEmailService().send({
        to: app.candidateEmail,
        subject: `Reminder: choose your interview time — ${app.job!.title}`,
        html: buildNudgeHtml(app.candidateName, app.job!.title, scheduleUrl),
      });

      const nowIso = new Date().toISOString();
      const { error: insertError } = await supabase.from("scheduled_nudges").insert({
        id: crypto.randomUUID(),
        applicationId: app.id,
        nudgeType: "SLOT_SELECTION_24H",
        scheduledFor: nowIso,
        sentAt: nowIso,
        createdAt: nowIso,
      });

      if (insertError && insertError.code === "23505") {
        await supabase
          .from("scheduled_nudges")
          .update({ sentAt: nowIso })
          .eq("applicationId", app.id)
          .eq("nudgeType", "SLOT_SELECTION_24H");
      } else if (insertError) {
        throw insertError;
      }

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
