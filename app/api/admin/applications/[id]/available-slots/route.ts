import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getInterviewerEmail, SlotOfferError } from "@/lib/services/calendarService";
import { getCalendarService } from "@/lib/integrations/calendar";
import { supabase } from "@/lib/supabase";

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

    const { data: blockedData } = await supabase
      .from("interview_slots")
      .select("startTime")
      .in("status", ["HELD", "CONFIRMED"]);

    const blockedMs = new Set(
      (blockedData ?? []).map((s) => new Date((s as Record<string, unknown>).startTime as string).getTime())
    );

    const { data: heldData } = await supabase
      .from("interview_slots")
      .select("startTime, endTime")
      .eq("applicationId", id)
      .eq("status", "HELD");

    const thisAppHeldSlots = (heldData ?? []) as Array<{ startTime: string; endTime: string }>;
    const thisAppHeldMs = new Set(thisAppHeldSlots.map((s) => new Date(s.startTime).getTime()));

    const slots = rawSlots
      .filter((s) => {
        const ms = s.start.getTime();
        if (blockedMs.has(ms) && !thisAppHeldMs.has(ms)) return false;
        return true;
      })
      .map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        pendingThisApp: thisAppHeldMs.has(s.start.getTime()),
      }));

    for (const held of thisAppHeldSlots) {
      const alreadyIncluded = slots.some((s) => s.start === held.startTime);
      if (!alreadyIncluded) {
        slots.push({
          start: held.startTime,
          end: held.endTime,
          pendingThisApp: true,
        });
      }
    }

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
