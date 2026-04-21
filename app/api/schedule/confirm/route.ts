import { NextRequest, NextResponse } from "next/server";
import { verifyScheduleToken } from "@/lib/auth/scheduleToken";
import { confirmInterviewSlot, SlotConfirmError } from "@/lib/services/calendarService";

export async function POST(req: NextRequest) {
  let body: { token: string; slotId: string };
  try {
    body = await req.json() as { token: string; slotId: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, slotId } = body;
  if (!token || !slotId) {
    return NextResponse.json({ error: "token and slotId are required" }, { status: 400 });
  }

  let applicationId: string;
  try {
    applicationId = await verifyScheduleToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired schedule link" }, { status: 401 });
  }

  try {
    await confirmInterviewSlot(applicationId, slotId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SlotConfirmError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Confirm slot error:`, err);
    return NextResponse.json({ error: "Failed to confirm slot" }, { status: 500 });
  }
}
