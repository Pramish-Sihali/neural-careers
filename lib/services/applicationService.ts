import { render } from "@react-email/components";
import { createApplication, getApplicationByEmailAndJob } from "@/lib/repositories/applicationRepo";
import { parseResumeBuffer, uploadResume, finalizePendingResume } from "@/lib/services/resumeService";
import { getEmailService } from "@/lib/integrations/email";
import { getJobById } from "@/lib/repositories/jobRepo";
import type { Application } from "@/lib/types/database";
import { supabase } from "@/lib/supabase";

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

  const application = await createApplication({
    jobId: input.jobId,
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
    await supabase
      .from("applications")
      .update({ resumeUrl, updatedAt: new Date().toISOString() })
      .eq("id", application.id);
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

/**
 * Fast-path submit for the immediate-upload flow: the resume is already
 * parsed (resumeText) and stored at a pending path (pendingStoragePath).
 * Skips the parse-on-submit hot path and moves the pending object to its
 * final applicationId-keyed location inside Supabase Storage.
 *
 * DEV-07 is preserved — if the storage move fails, the application row is
 * still committed with the pending path so the candidate gets a success
 * response and admins can still access the file via the pending path.
 */
export interface SubmitApplicationWithUploadInput {
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  yearsOfExperience: number;
  coverLetter?: string;
  resumeText: string;
  pendingStoragePath: string;
  contentType: string;
}

export async function submitApplicationWithUpload(
  input: SubmitApplicationWithUploadInput
): Promise<Application> {
  const job = await getJobById(input.jobId);
  if (!job || !job.isActive) throw new JobNotFoundError(input.jobId);

  const existing = await getApplicationByEmailAndJob(
    input.candidateEmail,
    input.jobId
  );
  if (existing) throw new DuplicateApplicationError();

  const application = await createApplication({
    jobId: input.jobId,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    linkedinUrl: input.linkedinUrl,
    githubUrl: input.githubUrl,
    phone: input.phone,
    yearsOfExperience: input.yearsOfExperience,
    coverLetter: input.coverLetter,
    resumeUrl: input.pendingStoragePath,
    resumeText: input.resumeText,
  });

  // Non-fatal — on move failure, finalizePendingResume returns the original
  // path and the application row keeps the pending path, which still resolves
  // to the already-uploaded file.
  const finalPath = await finalizePendingResume(
    input.pendingStoragePath,
    application.id,
    input.contentType
  );
  if (finalPath !== input.pendingStoragePath) {
    await supabase
      .from("applications")
      .update({ resumeUrl: finalPath, updatedAt: new Date().toISOString() })
      .eq("id", application.id);
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
    console.error("Confirmation email failed:", err);
  }
}
