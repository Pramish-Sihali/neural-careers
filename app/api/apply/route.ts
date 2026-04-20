import { NextRequest, NextResponse } from "next/server";
import { submitApplication, DuplicateApplicationError, JobNotFoundError } from "@/lib/services/applicationService";
import { ResumeParseError } from "@/lib/services/resumeService";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Frontend sends roleId, name, email — map to service contract
    const jobId = formData.get("roleId") as string | null;
    const candidateName = formData.get("name") as string | null;
    const candidateEmail = formData.get("email") as string | null;
    const resumeFile = formData.get("resume") as File | null;

    if (!jobId || !candidateName || !candidateEmail || !resumeFile) {
      return NextResponse.json(
        { error: "roleId, name, email, and resume are required" },
        { status: 400 }
      );
    }

    const yearsRaw = formData.get("yearsOfExperience");
    const yearsOfExperience = yearsRaw ? Number(yearsRaw) : 0;
    const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());

    const application = await submitApplication({
      jobId,
      candidateName,
      candidateEmail,
      phone: (formData.get("phone") as string) || undefined,
      linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
      githubUrl: (formData.get("githubUrl") as string) || undefined,
      yearsOfExperience,
      coverLetter: (formData.get("coverLetter") as string) || undefined,
      resumeBuffer,
      resumeFileName: resumeFile.name,
      resumeMimeType: resumeFile.type,
    });

    return NextResponse.json({ applicationId: application.id }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateApplicationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof JobNotFoundError) {
      // 410 Gone — frontend specifically handles this for closed roles
      return NextResponse.json({ error: err.message }, { status: 410 });
    }
    if (err instanceof ResumeParseError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error("POST /api/apply error:", err);
    return NextResponse.json({ error: "Application submission failed" }, { status: 500 });
  }
}
