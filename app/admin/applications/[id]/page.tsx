import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ScreenActions } from "@/components/admin/ScreenActions";

async function getApplication(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: { job: true, enrichment: true },
  });
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getApplication(id);
  if (!app) notFound();

  const screening = app.screeningSummary as {
    strengths?: string[];
    gaps?: string[];
    rationale?: string;
    recommendation?: string;
  } | null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin/applications"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All candidates
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{app.candidateName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{app.candidateEmail}</p>
          <p className="text-sm text-muted-foreground">{app.job.title}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge status={app.status} />
          {app.fitScore !== null && (
            <span className="text-lg font-bold">{app.fitScore}/100</span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Screening Actions */}
        <ScreenActions applicationId={app.id} currentStatus={app.status} />

        {/* Screening Result */}
        {screening && (
          <section className="rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold">AI Screening Result</h2>
            <p className="text-sm text-muted-foreground">{screening.rationale}</p>
            {screening.strengths && screening.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">Strengths</p>
                <ul className="space-y-1">
                  {screening.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-green-500">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {screening.gaps && screening.gaps.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">Gaps</p>
                <ul className="space-y-1">
                  {screening.gaps.map((g, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-red-400">✗</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Enrichment */}
        {app.enrichment && (
          <section className="rounded-lg border p-6 space-y-3">
            <h2 className="font-semibold">Candidate Research</h2>
            <p className="text-sm text-muted-foreground">{app.enrichment.candidateBrief}</p>
            {app.enrichment.githubDigest && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">GitHub</p>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto">
                  {JSON.stringify(app.enrichment.githubDigest, null, 2)}
                </pre>
              </div>
            )}
          </section>
        )}

        {/* Resume text */}
        <section className="rounded-lg border p-6">
          <h2 className="font-semibold mb-3">Resume Text</h2>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-y-auto">
            {app.resumeText}
          </pre>
        </section>
      </div>
    </main>
  );
}
