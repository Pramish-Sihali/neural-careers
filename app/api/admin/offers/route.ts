import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { validateBody } from "@/lib/utils/validateBody";
import { errorResponse } from "@/lib/utils/apiHelpers";
import {
  generateOfferDraft,
  OfferNotFoundError,
  OfferStateError,
} from "@/lib/services/offerService";
import { getApplicationById } from "@/lib/repositories/applicationRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  applicationId: z.string().min(1),
  jobTitle: z.string().min(1).max(200),
  startDate: z.string().date(), // YYYY-MM-DD
  baseSalary: z.number().int().positive().max(10_000_000),
  compensationStructure: z.string().min(1).max(200),
  equity: z.string().max(500).optional().nullable(),
  bonus: z.string().max(500).optional().nullable(),
  reportingManager: z.string().min(1).max(200),
  customTerms: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { data: body, error } = await validateBody(req, BodySchema);
  if (error) return error;

  const app = await getApplicationById(body.applicationId);
  if (!app) return errorResponse("Application not found", 404);

  let result;
  try {
    result = await generateOfferDraft({
      applicationId: body.applicationId,
      candidateName: app.candidateName,
      jobTitle: body.jobTitle,
      startDate: new Date(body.startDate + "T00:00:00Z"),
      baseSalary: body.baseSalary,
      compensationStructure: body.compensationStructure,
      equity: body.equity ?? null,
      bonus: body.bonus ?? null,
      reportingManager: body.reportingManager,
      customTerms: body.customTerms ?? null,
    });
  } catch (err) {
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    console.error("generateOfferDraft error:", err);
    return errorResponse("Failed to start offer generation", 502);
  }

  const { offer, stream, finalize } = result;
  let accumulated = "";
  const encoder = new TextEncoder();

  const body$ = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          accumulated += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        await finalize(accumulated);
        controller.enqueue(encoder.encode(`\n\n[OFFER_ID:${offer.id}]`));
        controller.close();
      } catch (err) {
        console.error("Offer streaming error:", err);
        controller.enqueue(encoder.encode("\n\n[ERROR:generation failed]"));
        controller.close();
      }
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Offer-Id": offer.id,
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
