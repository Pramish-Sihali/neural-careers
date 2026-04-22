import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/utils/validateBody";
import { errorResponse } from "@/lib/utils/apiHelpers";
import { verifyOfferToken } from "@/lib/auth/offerToken";
import {
  signOffer,
  OfferNotFoundError,
  OfferStateError,
  SignatureTooSmallError,
} from "@/lib/services/offerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().min(1),
  signatureBase64: z
    .string()
    .min(200)
    .refine(
      (s) => s.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(s),
      "Must be a base64 data URL or raw base64 string"
    ),
});

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: body, error } = await validateBody(req, BodySchema);
  if (error) return error;

  let tokenOfferId: string;
  try {
    tokenOfferId = await verifyOfferToken(body.token, "sign-offer");
  } catch {
    // Fall back to view-offer tokens — same candidate, same offer
    try {
      tokenOfferId = await verifyOfferToken(body.token, "view-offer");
    } catch {
      return errorResponse("Invalid or expired token", 403);
    }
  }

  if (tokenOfferId !== id) return errorResponse("Token does not match offer", 403);

  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const { offer, signature, alreadySigned } = await signOffer({
      offerId: id,
      signatureBase64: body.signatureBase64,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      offerId: offer.id,
      status: offer.status,
      signedAt: signature.signedAt.toISOString(),
      confirmationNumber: `SIGN-${signature.id.slice(0, 8).toUpperCase()}`,
      alreadySigned,
    });
  } catch (err) {
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    if (err instanceof SignatureTooSmallError) return errorResponse(err.message, 400);
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    console.error("POST /offers/[id]/sign error:", err);
    return errorResponse("Failed to sign offer", 500);
  }
}
