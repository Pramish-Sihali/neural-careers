import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { prisma } from "@/lib/prisma";
import { enrichCandidate } from "@/lib/services/enrichmentService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;

  const application = await prisma.application.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (application.status !== "SCREENED") {
    return NextResponse.json(
      { error: "Application must be SCREENED before shortlisting" },
      { status: 409 }
    );
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: "SHORTLISTED", shortlistedAt: new Date() },
  });

  // Kick off enrichment async (may already be running from screening)
  enrichCandidate(id).catch((err) =>
    console.error(`Enrichment failed for ${id}:`, err)
  );

  return NextResponse.json({ status: updated.status });
}
