import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const urlPrefix = process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 90) ?? "NOT SET";
  try {
    const { count, error } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, count, url: urlPrefix });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ok: false, url: urlPrefix, message: err.message?.slice(0, 500) }, { status: 500 });
  }
}
