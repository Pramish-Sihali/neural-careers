import { prisma } from "@/lib/prisma";
import type { Job, Prisma } from "@prisma/client";

export async function listActiveJobs(): Promise<Job[]> {
  return prisma.job.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJobById(id: string): Promise<Job | null> {
  return prisma.job.findUnique({ where: { id } });
}

export async function createJob(data: Prisma.JobCreateInput): Promise<Job> {
  return prisma.job.create({ data });
}
