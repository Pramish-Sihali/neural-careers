import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabase } from "@/lib/supabase";
import { screenApplication, AlreadyScreenedError } from "@/lib/services/screeningService";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { data, error } = await supabase
    .from("applications")
    .select("id")
    .eq("status", "APPLIED");

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
  const applied = data ?? [];

  if (applied.length === 0) {
    return NextResponse.json({ screened: 0, failed: 0 });
  }

  let screened = 0;
  let failed = 0;

  for (const app of applied) {
    try {
      await screenApplication((app as Record<string, unknown>).id as string);
      screened++;
    } catch (err) {
      if (err instanceof AlreadyScreenedError) continue;
      console.error(`Batch screen failed for ${(app as Record<string, unknown>).id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ screened, failed });
}
