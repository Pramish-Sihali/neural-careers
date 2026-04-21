import { render } from "@react-email/components";
import { createApplication, getApplicationByEmailAndJob } from "@/lib/repositories/applicationRepo";
import { parseResumeBuffer, uploadResume } from "@/lib/services/resumeService";
import { getEmailService } from "@/lib/integrations/email";
import { getJobById } from "@/lib/repositories/jobRepo";
import type { Application } from "@prisma/client";

export class DuplicateApplicationError extends Error {
  constructor() {
    super("You have already applied for this position");
    this.name = "DuplicateApplicationError";
  }
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} not found or is no longer active`);
    this.name = "JobNotFoundError";
  }
}

export interface SubmitApplicationInput {
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  yearsOfExperience: number;
  coverLetter?: string;
  resumeBuffer: Buffer;
  resumeFileName: string;
  resumeMimeType: string;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<Application> {
  const job = await getJobById(input.jobId);
  if (!job || !job.isActive) throw new JobNotFoundError(input.jobId);

  const existing = await getApplicationByEmailAndJob(
    input.candidateEmail,
    input.jobId
  );
  if (existing) throw new DuplicateApplicationError();

  const resumeText = await parseResumeBuffer(input.resumeBuffer, input.resumeFileName);

  // Create application first to get the ID for the storage path
  const application = await createApplication({
    job: { connect: { id: input.jobId } },
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    linkedinUrl: input.linkedinUrl,
    githubUrl: input.githubUrl,
    phone: input.phone,
    yearsOfExperience: input.yearsOfExperience,
    coverLetter: input.coverLetter,
    resumeUrl: "pending",
    resumeText,
  });

  // Storage upload is non-fatal — app is already saved, resumeUrl updates async
  try {
    const resumeUrl = await uploadResume(
      input.resumeBuffer,
      application.id,
      input.resumeMimeType
    );
    const { prisma } = await import("@/lib/prisma");
    await prisma.application.update({
      where: { id: application.id },
      data: { resumeUrl },
    });
  } catch (err) {
    console.error("Resume storage upload failed (non-fatal):", err);
  }

  await sendConfirmationEmail(
    input.candidateEmail,
    input.candidateName,
    job.title,
    application.id
  );

  return application;
}

async function sendConfirmationEmail(
  email: string,
  name: string,
  jobTitle: string,
  applicationId: string
) {
  try {
    // Dynamic import to avoid SSR issues with React Email
    const { default: ApplicationConfirmation } = await import(
      "@/emails/ApplicationConfirmation"
    );
    const html = await render(
      ApplicationConfirmation({ candidateName: name, jobTitle, applicationId })
    );
    await getEmailService().send({
      to: email,
      subject: `Application received — ${jobTitle}`,
      html,
    });
  } catch (err) {
    // Non-fatal: log but don't fail the application submission
    console.error("Confirmation email failed:", err);
  }
}
