import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { sendOnboardingInvite } from "@/lib/services/onboardingService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Admin "resend" is explicit — pass force: true so the service re-sends even
  // if inviteEmailSentAt is already set. For the first send, force is a no-op.
  const result = await sendOnboardingInvite(id, { force: true });

  if (!result.sent && result.reason === "application_not_found") {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!result.sent && result.reason === "SLACK_INVITE_LINK_missing") {
    return NextResponse.json({ error: "SLACK_INVITE_LINK env var not set" }, { status: 500 });
  }
  return NextResponse.json(result);
}
