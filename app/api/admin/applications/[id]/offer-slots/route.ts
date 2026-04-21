import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { offerInterviewSlots, SlotOfferError } from "@/lib/services/calendarService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  try {
    await offerInterviewSlots(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SlotOfferError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Offer slots error for ${id}:`, err);
    return NextResponse.json({ error: "Failed to offer slots" }, { status: 500 });
  }
}
