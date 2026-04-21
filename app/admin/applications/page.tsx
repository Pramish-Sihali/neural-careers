import { prisma } from "@/lib/prisma";
import { AdminPipelineClient } from "@/components/admin/AdminPipelineClient";
import type { NewApplicationRow } from "@/components/admin/NewApplicationsTable";
import type { PipelineRow } from "@/components/admin/PipelineTable";
import type { CalendarSlot } from "@/components/admin/AdminCalendar";

async function getData() {
  const [applications, slots] = await Promise.all([
    prisma.application.findMany({
      include: { job: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interviewSlot.findMany({
      include: { application: { include: { job: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const newApps: NewApplicationRow[] = applications
    .filter((a) => a.status === "APPLIED")
    .map((a) => ({
      id: a.id,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      jobTitle: a.job.title,
      createdAt: a.createdAt.toISOString(),
    }));

  const pipeline: PipelineRow[] = applications
    .filter((a) => a.status !== "APPLIED")
    .map((a) => ({
      id: a.id,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      status: a.status,
      fitScore: a.fitScore,
      jobTitle: a.job.title,
      createdAt: a.createdAt.toISOString(),
    }));

  const calendarSlots: CalendarSlot[] = slots.map((s) => ({
    id: s.id,
    candidateName: s.application.candidateName,
    jobTitle: s.application.job.title,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    status: s.status,
  }));

  return { newApps, pipeline, calendarSlots };
}

export default async function AdminApplicationsPage() {
  const { newApps, pipeline, calendarSlots } = await getData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Candidate Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {newApps.length + pipeline.length} total application
          {newApps.length + pipeline.length !== 1 ? "s" : ""}
        </p>
      </div>
      <AdminPipelineClient
        initialNewApps={newApps}
        initialPipeline={pipeline}
        calendarSlots={calendarSlots}
      />
    </main>
  );
}
