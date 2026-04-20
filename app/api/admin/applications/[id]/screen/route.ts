import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { screenApplication, AlreadyScreenedError } from "@/lib/services/screeningService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  try {
    const result = await screenApplication(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AlreadyScreenedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(`Screen error for ${id}:`, err);
    return NextResponse.json({ error: "Screening failed" }, { status: 500 });
  }
}
