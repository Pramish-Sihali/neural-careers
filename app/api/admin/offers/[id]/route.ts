import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { validateBody } from "@/lib/utils/validateBody";
import { errorResponse } from "@/lib/utils/apiHelpers";
import {
  editDraft,
  OfferNotFoundError,
  OfferStateError,
  getOfferWithSignature,
} from "@/lib/services/offerService";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  letterHtml: z.string().min(1).max(100_000),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const offer = await getOfferWithSignature(id);
  if (!offer) return errorResponse("Offer not found", 404);

  return NextResponse.json({
    id: offer.id,
    applicationId: offer.applicationId,
    status: offer.status,
    jobTitle: offer.jobTitle,
    startDate: offer.startDate.toISOString(),
    baseSalary: offer.baseSalary,
    compensationStructure: offer.compensationStructure,
    equity: offer.equity,
    bonus: offer.bonus,
    reportingManager: offer.reportingManager,
    customTerms: offer.customTerms,
    letterHtml: offer.letterHtml,
    letterHash: offer.letterHash,
    sentAt: offer.sentAt?.toISOString() ?? null,
    signedAt: offer.signedAt?.toISOString() ?? null,
    candidateName: offer.application?.candidateName ?? null,
    candidateEmail: offer.application?.candidateEmail ?? null,
    signature: offer.signature
      ? {
          id: offer.signature.id,
          signedAt: offer.signature.signedAt.toISOString(),
          ipAddress: offer.signature.ipAddress,
          userAgent: offer.signature.userAgent,
          signatureHash: offer.signature.signatureHash,
        }
      : null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const { data: body, error } = await validateBody(req, PatchSchema);
  if (error) return error;

  try {
    const offer = await editDraft(id, body.letterHtml);
    return NextResponse.json({
      id: offer.id,
      status: offer.status,
      letterHtml: offer.letterHtml,
      updatedAt: offer.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    console.error("PATCH /offers/[id] error:", err);
    return errorResponse("Failed to update offer", 500);
  }
}
