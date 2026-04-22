import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { screenApplication, AlreadyScreenedError } from "@/lib/services/screeningService";
import { errorResponse } from "@/lib/utils/apiHelpers";

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
      return errorResponse(err.message, 409);
    }
    console.error(`Screen error for ${id}:`, err);
    return errorResponse("Screening failed", 500);
  }
}
