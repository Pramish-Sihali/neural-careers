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

  // Parse optional explicit slots from body
  let explicitSlots: Array<{ start: Date; end: Date }> | undefined;
  try {
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text) as { slots?: Array<{ start: string; end: string }> };
      if (Array.isArray(body.slots) && body.slots.length > 0) {
        explicitSlots = body.slots.map((s) => ({
          start: new Date(s.start),
          end: new Date(s.end),
        }));
      }
    }
  } catch {
    // body parse failure is non-fatal — fall back to auto-generate
  }

  try {
    await offerInterviewSlots(id, explicitSlots);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SlotOfferError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Offer slots error for ${id}:`, err);
    return NextResponse.json({ error: "Failed to offer slots" }, { status: 500 });
  }
}
