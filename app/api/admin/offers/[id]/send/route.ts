import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { errorResponse } from "@/lib/utils/apiHelpers";
import {
  sendOffer,
  OfferNotFoundError,
  OfferStateError,
} from "@/lib/services/offerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    customNote: z.string().max(1000).optional().nullable(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  // Body is optional — accept empty request
  let customNote: string | null = null;
  try {
    const raw = await req.text();
    if (raw) {
      const parsed = JSON.parse(raw);
      const result = BodySchema.safeParse(parsed);
      if (result.success && result.data) {
        customNote = result.data.customNote ?? null;
      }
    }
  } catch {
    // ignore malformed body — treat as no customNote
  }

  try {
    const { offer, sentTo } = await sendOffer(id, customNote);
    return NextResponse.json({
      offerId: offer.id,
      status: offer.status,
      sentAt: offer.sentAt?.toISOString() ?? null,
      sentTo,
      letterHash: offer.letterHash,
    });
  } catch (err) {
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    console.error("POST /offers/[id]/send error:", err);
    return errorResponse("Failed to send offer", 500);
  }
}
