import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@prisma/client";

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
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: body.status as ApplicationStatus },
  });

  return NextResponse.json({ status: updated.status });
}
