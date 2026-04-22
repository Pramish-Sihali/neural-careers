import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabase } from "@/lib/supabase";
import { enrichCandidate } from "@/lib/services/enrichmentService";
import { errorResponse, now } from "@/lib/utils/apiHelpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  const { data, error } = await supabase
    .from("applications")
    .select("status")
    .eq("id", id)
    .single();

  if (error || !data) return errorResponse("Not found", 404);
  const app = data as Record<string, unknown>;
  if (app.status !== "SCREENED") {
    return errorResponse("Application must be SCREENED before shortlisting", 409);
  }

  const ts = now();
  const { data: updated, error: updateError } = await supabase
    .from("applications")
    .update({ status: "SHORTLISTED", shortlistedAt: ts, updatedAt: ts })
    .eq("id", id)
    .select("status")
    .single();

  if (updateError) return errorResponse("Update failed", 500);

  enrichCandidate(id).catch((err) =>
    console.error(`Enrichment failed for ${id}:`, err)
  );

  return NextResponse.json({ status: (updated as Record<string, unknown>).status });
}
