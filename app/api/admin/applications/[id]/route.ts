import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*), enrichment:candidate_enrichments(*)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(parseApplicationRow(data as Record<string, unknown>));
}
