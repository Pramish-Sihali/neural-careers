import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getInterviewerEmail, SlotOfferError } from "@/lib/services/calendarService";
import { getCalendarService } from "@/lib/integrations/calendar";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  try {
    const interviewerEmail = await getInterviewerEmail();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const twoWeeksOut = new Date(tomorrow.getTime() + 14 * 24 * 60 * 60 * 1000);

    const calendar = getCalendarService();
    const rawSlots = await calendar.getAvailableSlots(
      interviewerEmail,
      tomorrow,
      twoWeeksOut,
      60
    );

    // Fetch all startTimes that are already HELD or CONFIRMED (any application — no double booking)
    const blockedSlots = await prisma.interviewSlot.findMany({
      where: {
        status: { in: ["HELD", "CONFIRMED"] },
      },
      select: { startTime: true },
    });

    const blockedMs = new Set(blockedSlots.map((s) => s.startTime.getTime()));

    // Also fetch HELD slots for THIS application so the modal can show "Awaiting response" pills
    const thisAppHeldSlots = await prisma.interviewSlot.findMany({
      where: { applicationId: id, status: "HELD" },
      select: { startTime: true, endTime: true },
    });

    const thisAppHeldMs = new Set(thisAppHeldSlots.map((s) => s.startTime.getTime()));

    // Filter out slots blocked by OTHER applications (slots already held by this app are shown differently)
    const slots = rawSlots
      .filter((s) => {
        const ms = s.start.getTime();
        // Blocked by another application — exclude entirely
        if (blockedMs.has(ms) && !thisAppHeldMs.has(ms)) return false;
        return true;
      })
      .map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        pendingThisApp: thisAppHeldMs.has(s.start.getTime()),
      }));

    // Append any HELD slots for this application that didn't show up in rawSlots
    for (const held of thisAppHeldSlots) {
      const alreadyIncluded = slots.some((s) => s.start === held.startTime.toISOString());
      if (!alreadyIncluded) {
        slots.push({
          start: held.startTime.toISOString(),
          end: held.endTime.toISOString(),
          pendingThisApp: true,
        });
      }
    }

    // Sort chronologically
    slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({ slots });
  } catch (err) {
    if (err instanceof SlotOfferError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Available slots error for ${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch available slots" }, { status: 500 });
  }
}
