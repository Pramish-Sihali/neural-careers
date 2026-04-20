import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/repositories/jobRepo";
import { toJobDetail } from "@/lib/utils/jobTransform";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(toJobDetail(job));
  } catch (err) {
    console.error("GET /api/jobs/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
