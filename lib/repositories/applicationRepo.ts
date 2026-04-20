import { prisma } from "@/lib/prisma";
import type { Application, ApplicationStatus, Prisma } from "@prisma/client";

export async function createApplication(
  data: Prisma.ApplicationCreateInput
): Promise<Application> {
  return prisma.application.create({ data });
}

export async function getApplicationById(
  id: string
): Promise<Application | null> {
  return prisma.application.findUnique({ where: { id }, include: { job: true } });
}

export async function getApplicationByEmailAndJob(
  candidateEmail: string,
  jobId: string
): Promise<Application | null> {
  return prisma.application.findUnique({
    where: { candidateEmail_jobId: { candidateEmail, jobId } },
  });
}

export async function listApplications(filters?: {
  status?: ApplicationStatus;
  jobId?: string;
}): Promise<Application[]> {
  return prisma.application.findMany({
    where: filters,
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<Application> {
  return prisma.application.update({ where: { id }, data: { status } });
}
