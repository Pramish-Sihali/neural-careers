import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/utils/apiHelpers";
import { verifyOfferToken } from "@/lib/auth/offerToken";
import { getOfferWithSignature } from "@/lib/services/offerService";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) return errorResponse("Missing token", 401);

  let tokenOfferId: string;
  try {
    // Accept either view-offer OR sign-offer; signing page uses the same GET
    try {
      tokenOfferId = await verifyOfferToken(token, "view-offer");
    } catch {
      tokenOfferId = await verifyOfferToken(token, "sign-offer");
    }
  } catch {
    return errorResponse("Invalid or expired token", 403);
  }

  if (tokenOfferId !== id) return errorResponse("Token does not match offer", 403);

  const offer = await getOfferWithSignature(id);
  if (!offer) return errorResponse("Offer not found", 404);
  if (offer.status === "VOIDED") return errorResponse("Offer has been revoked", 410);

  const app = offer.application;
  return NextResponse.json({
    offerId: offer.id,
    status: offer.status,
    candidateName: app?.candidateName ?? "",
    roleTitle: offer.jobTitle,
    companyName: "Niural",
    letterHtml: offer.letterHtml,
    baseSalary: offer.baseSalary,
    startDate: offer.startDate.toISOString(),
    sentAt: offer.sentAt?.toISOString() ?? null,
    signedAt: offer.signedAt?.toISOString() ?? null,
    alreadySigned: offer.status === "SIGNED",
  });
}
