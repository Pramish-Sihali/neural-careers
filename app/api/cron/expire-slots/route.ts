import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarService } from "@/lib/integrations/calendar";

// Called by Vercel Cron (or manually) every 15 minutes.
// Authorization: Bearer CRON_SECRET
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.interviewSlot.findMany({
    where: {
      status: "HELD",
      holdExpiresAt: { lt: new Date() },
    },
    select: { id: true, googleEventId: true, interviewerEmail: true },
  });

  if (expired.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  const calendar = getCalendarService();

  await Promise.allSettled(
    expired.map(async (slot) => {
      if (slot.googleEventId) {
        await calendar.releaseSlot(slot.interviewerEmail, slot.googleEventId).catch(() => null);
      }
    })
  );

  await prisma.interviewSlot.updateMany({
    where: { id: { in: expired.map((s) => s.id) } },
    data: { status: "EXPIRED" },
  });

  console.log(`Expired ${expired.length} held slots`);
  return NextResponse.json({ expired: expired.length });
}
