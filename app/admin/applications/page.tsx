import { prisma } from "@/lib/prisma";
import { AdminPipelineClient } from "@/components/admin/AdminPipelineClient";
import type { NewApplicationRow } from "@/components/admin/NewApplicationsTable";
import type { PipelineRow } from "@/components/admin/PipelineTable";
import type { ActivitySlot } from "@/components/admin/InterviewActivityFeed";

async function getData(searchParams: Record<string, string>) {
  const [applications, slots, calendarCreds] = await Promise.all([
    prisma.application.findMany({
      include: { job: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interviewSlot.findMany({
      include: { application: { include: { job: true } } },
      orderBy: { startTime: "asc" },
    }),
    process.env.USE_MOCK_CALENDAR !== "true"
      ? prisma.interviewerCredentials.findFirst({ select: { interviewerEmail: true } })
      : Promise.resolve(null),
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

  const activitySlots: ActivitySlot[] = slots.map((s) => ({
    id: s.id,
    applicationId: s.applicationId,
    candidateName: s.application.candidateName,
    jobTitle: s.application.job.title,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    status: s.status,
  }));

  const authStatus = searchParams.calendar_auth as string | undefined;
  const calendarConnected = !!calendarCreds;

  return { newApps, pipeline, activitySlots, calendarConnected, authStatus };
}

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function AdminApplicationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { newApps, pipeline, activitySlots, calendarConnected, authStatus } =
    await getData(sp);

  const useMock = process.env.USE_MOCK_CALENDAR === "true";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      {/* Google Calendar auth banner — only shown in real mode */}
      {!useMock && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            calendarConnected
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          <span>
            {authStatus === "success" && "✓ Google Calendar connected successfully. "}
            {authStatus === "error" && "⚠ Google auth failed — please try again. "}
            {authStatus === "denied" && "⚠ Google auth was cancelled. "}
            {calendarConnected
              ? "Google Calendar is connected — real slots and Meet links are active."
              : "Google Calendar is not connected. Interview slots will fail until you connect."}
          </span>
          {!calendarConnected && (
            <a
              href={`/api/auth/google?authorization=Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`}
              className="ml-4 rounded-md bg-yellow-700 px-3 py-1.5 text-xs text-white hover:bg-yellow-800 whitespace-nowrap"
            >
              Connect Google Calendar →
            </a>
          )}
        </div>
      )}

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
        activitySlots={activitySlots}
      />
    </main>
  );
}
