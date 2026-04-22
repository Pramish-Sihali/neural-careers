import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabase } from "@/lib/supabase";
import { getNotetakerService } from "@/lib/integrations/notetaker";
import { errorResponse } from "@/lib/utils/apiHelpers";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, meetingUrl, status")
    .eq("applicationId", id)
    .maybeSingle();

  if (error) return errorResponse("Database error", 500);
  if (!interview) return errorResponse("No interview found for this application", 404);
  if (!interview.meetingUrl) {
    return errorResponse(
      "No meeting URL found for this interview. The calendar event may not have been created yet.",
      400
    );
  }

  const notetaker = getNotetakerService();
  const result = await notetaker.addToMeeting(interview.meetingUrl);

  if (!result.success) return errorResponse(result.message, 422);

  return NextResponse.json({ success: true, message: result.message });
}
