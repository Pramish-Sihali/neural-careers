import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { prisma } from "@/lib/prisma";
import { screenApplication, AlreadyScreenedError } from "@/lib/services/screeningService";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const applied = await prisma.application.findMany({
    where: { status: "APPLIED" },
    select: { id: true },
  });

  if (applied.length === 0) {
    return NextResponse.json({ screened: 0, failed: 0 });
  }

  let screened = 0;
  let failed = 0;

  for (const app of applied) {
    try {
      await screenApplication(app.id);
      screened++;
    } catch (err) {
      if (err instanceof AlreadyScreenedError) continue;
      console.error(`Batch screen failed for ${app.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ screened, failed });
}
