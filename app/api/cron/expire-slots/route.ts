import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCalendarService } from "@/lib/integrations/calendar";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: expired, error } = await supabase
    .from("interview_slots")
    .select("id, googleEventId, interviewerEmail")
    .eq("status", "HELD")
    .lt("holdExpiresAt", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expired || expired.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  const calendar = getCalendarService();

  await Promise.allSettled(
    expired.map(async (slot) => {
      const s = slot as { googleEventId: string | null; interviewerEmail: string };
      if (s.googleEventId) {
        await calendar.releaseSlot(s.interviewerEmail, s.googleEventId).catch(() => null);
      }
    })
  );

  const ids = expired.map((s) => (s as Record<string, unknown>).id as string);
  await supabase
    .from("interview_slots")
    .update({ status: "EXPIRED", updatedAt: new Date().toISOString() })
    .in("id", ids);

  console.log(`Expired ${expired.length} held slots`);
  return NextResponse.json({ expired: expired.length });
}
