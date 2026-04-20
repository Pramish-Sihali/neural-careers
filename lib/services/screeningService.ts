import { prisma } from "@/lib/prisma";
import { screenResume } from "@/lib/ai/prompts/screenResume";
import { enrichCandidate } from "@/lib/services/enrichmentService";

export class AlreadyScreenedError extends Error {
  constructor() {
    super("Application has already been screened");
    this.name = "AlreadyScreenedError";
  }
}

export async function screenApplication(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!application) throw new Error(`Application ${applicationId} not found`);
  if (application.status !== "APPLIED") throw new AlreadyScreenedError();

  const jobDescription = [
    application.job.description,
    `Requirements: ${application.job.requirements}`,
    `Responsibilities: ${application.job.responsibilities}`,
  ].join("\n\n");

  const result = await screenResume(jobDescription, application.resumeText);

  // Optimistic lock: only update if version hasn't changed
  const updated = await prisma.application.updateMany({
    where: { id: applicationId, version: application.version },
    data: {
      status: "SCREENED",
      fitScore: result.fitScore,
      screeningSummary: result,
      screenedAt: new Date(),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new AlreadyScreenedError();
  }

  // Fire async enrichment for shortlist candidates — don't await
  if (result.recommendation === "SHORTLIST") {
    enrichCandidate(applicationId).catch((err) =>
      console.error(`Enrichment failed for ${applicationId}:`, err)
    );
  }

  return result;
}
