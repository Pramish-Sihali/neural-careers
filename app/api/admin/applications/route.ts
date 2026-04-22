import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listApplications } from "@/lib/repositories/applicationRepo";
import type { ApplicationStatus } from "@/lib/types/database";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ApplicationStatus | null;
  const jobId = searchParams.get("jobId") ?? undefined;

  const applications = await listApplications({ status: status ?? undefined, jobId });
  return NextResponse.json(applications);
}
