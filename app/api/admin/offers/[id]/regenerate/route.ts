import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { errorResponse } from "@/lib/utils/apiHelpers";
import {
  regenerateOfferDraft,
  OfferNotFoundError,
  OfferStateError,
} from "@/lib/services/offerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  let result;
  try {
    result = await regenerateOfferDraft(id);
  } catch (err) {
    if (err instanceof OfferStateError) return errorResponse(err.message, 409);
    if (err instanceof OfferNotFoundError) return errorResponse(err.message, 404);
    console.error("regenerateOfferDraft error:", err);
    return errorResponse("Failed to start regeneration", 502);
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
        console.error("Offer regeneration streaming error:", err);
        controller.enqueue(encoder.encode("\n\n[ERROR:regeneration failed]"));
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
