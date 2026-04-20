import type { Job } from "@prisma/client";

function splitBullets(text: string): string[] {
  return text
    .split(/\n|•/)
    .map((s) => s.replace(/^[-–]\s*/, "").trim())
    .filter(Boolean);
}

function textToHtml(text: string): string {
  return text
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");
}

export function toJobSummary(job: Job) {
  return {
    id: job.id,
    title: job.title,
    department: job.team,
    location: job.remote ? `${job.location} (Remote)` : job.location,
    employmentType: "FULL_TIME" as const,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    publishedAt: job.createdAt.toISOString(),
    closingDate: null,
    slug: job.id,
    status: job.isActive ? ("OPEN" as const) : ("CLOSED" as const),
  };
}

export function toJobDetail(job: Job) {
  return {
    ...toJobSummary(job),
    descriptionHtml: textToHtml(job.description),
    requirements: splitBullets(job.requirements),
    benefits: [] as string[],
  };
}
