import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { enrichCandidate } from "@/lib/services/enrichmentService";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;

  try {
    await enrichCandidate(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(`[admin/applications/${id}/enrich] failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
