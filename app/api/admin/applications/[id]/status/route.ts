import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabase } from "@/lib/supabase";
import type { ApplicationStatus } from "@/lib/types/database";
import { errorResponse, now } from "@/lib/utils/apiHelpers";

const VALID_STATUSES = new Set<ApplicationStatus>([
  "APPLIED", "SCREENED", "SHORTLISTED", "INTERVIEWING",
  "POST_INTERVIEW", "OFFER_SENT", "OFFER_SIGNED", "ONBOARDED",
  "REJECTED", "WITHDRAWN",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const body = await req.json() as { status?: unknown };

  if (!body.status || !VALID_STATUSES.has(body.status as ApplicationStatus)) {
    return errorResponse("Invalid status", 422);
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: body.status, updatedAt: now() })
    .eq("id", id)
    .select("status")
    .single();

  if (error) return errorResponse("Not found", 404);
  return NextResponse.json({ status: (data as Record<string, unknown>).status });
}
