import { CandidateTable, type CandidateRow } from "@/components/admin/CandidateTable";
import { prisma } from "@/lib/prisma";

async function getApplications(): Promise<CandidateRow[]> {
  const apps = await prisma.application.findMany({
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });

  return apps.map((a) => ({
    id: a.id,
    candidateName: a.candidateName,
    candidateEmail: a.candidateEmail,
    status: a.status,
    fitScore: a.fitScore,
    jobTitle: a.job.title,
    createdAt: a.createdAt.toISOString(),
  }));
}

export default async function AdminApplicationsPage() {
  const applications = await getApplications();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Candidate Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications.length} total application{applications.length !== 1 ? "s" : ""}
        </p>
      </div>
      <CandidateTable data={applications} />
    </main>
  );
}
