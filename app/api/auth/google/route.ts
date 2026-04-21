import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/integrations/calendar/googleOAuth";

// No auth guard — this just redirects to Google's consent screen.
// The callback is where tokens are saved; that endpoint is scoped to localhost only.
export async function GET() {
  return NextResponse.redirect(getAuthUrl());
}
