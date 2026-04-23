import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/utils/validateBody";
import { extractResumeHeader } from "@/lib/ai/prompts/extractResumeHeader";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resumeText: z.string().min(40).max(20_000),
});

export async function POST(req: NextRequest) {
  const { data, error } = await validateBody(req, RequestSchema);
  if (error) return error;

  try {
    const header = await extractResumeHeader({ resumeText: data.resumeText });
    return NextResponse.json(header, { status: 200 });
  } catch (err) {
    console.error("[api/apply/extract-header] extraction failed:", err);
    return NextResponse.json(
      { error: "Could not extract resume header." },
      { status: 500 }
    );
  }
}
