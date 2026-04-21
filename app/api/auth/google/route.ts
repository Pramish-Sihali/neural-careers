import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getAuthUrl } from "@/lib/integrations/calendar/googleOAuth";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  return NextResponse.redirect(getAuthUrl());
}
