import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { errorResponse } from "@/lib/utils/apiHelpers";
import {
  voidOffer,
  OfferNotFoundError,
  OfferStateError,
} from "@/lib/services/offerService";
import { InvalidOfferTransitionError } from "@/lib/domain/offerStateMachine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  try {
    const offer = await voidOffer(id);
    return NextResponse.json({ offerId: offer.id, status: offer.status });
  } catch (err) {
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    if (err instanceof InvalidOfferTransitionError) {
      return errorResponse(err.message, 409);
    }
    console.error("POST /offers/[id]/void error:", err);
    return errorResponse("Failed to void offer", 500);
  }
}
