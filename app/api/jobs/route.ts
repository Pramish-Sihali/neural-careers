import { NextResponse } from "next/server";
import { listActiveJobs } from "@/lib/repositories/jobRepo";
import { toJobSummary } from "@/lib/utils/jobTransform";

export async function GET() {
  try {
    const jobs = await listActiveJobs();
    return NextResponse.json({ jobs: jobs.map(toJobSummary) });
  } catch (err) {
    console.error("GET /api/jobs error:", err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
