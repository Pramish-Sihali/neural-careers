import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { parseApplicationRow } from "@/lib/types/database";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ScreenActions } from "@/components/admin/ScreenActions";
import { SimulateInterviewButton } from "@/components/admin/SimulateInterviewButton";
import { SendBotButton } from "@/components/admin/SendBotButton";
import { SendOfferAccordion } from "@/components/admin/SendOfferAccordion";
import {
  ApplicationTabs,
  type ScreeningSummary,
  type EnrichmentData,
} from "@/components/admin/ApplicationTabs";
import { findLatestOfferForApplication } from "@/lib/repositories/offerRepo";

async function getApplication(id: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*), enrichment:candidate_enrichments(*), interview:interviews(*)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return parseApplicationRow(data as Record<string, unknown>);
}

async function getResumeSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath || storagePath === "pending") return null;
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await sb.storage
      .from("resumes")
      .createSignedUrl(storagePath, 60 * 30);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getApplication(id);
  if (!app) notFound();

  const resumeSignedUrl = await getResumeSignedUrl(app.resumeUrl);
  const latestOffer = await findLatestOfferForApplication(app.id);

  // Has the admin already offered slots on this application? Shown as a
  // subtext under the "Offer Interview Slots" button.
  const { count: offeredSlotCount } = await supabase
    .from("interview_slots")
    .select("id", { count: "exact", head: true })
    .eq("applicationId", app.id)
    .in("status", ["HELD", "CONFIRMED"]);
  const hasOfferedSlots = (offeredSlotCount ?? 0) > 0;

  const screening = (app.screeningSummary ?? null) as ScreeningSummary | null;
  const enrichment: EnrichmentData | null = app.enrichment
    ? {
        candidateBrief: app.enrichment.candidateBrief,
        githubDigest: app.enrichment.githubDigest,
        discrepancies: app.enrichment.discrepancies,
        linkedinSummary: app.enrichment.linkedinSummary,
        twitterSummary: app.enrichment.twitterSummary,
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin/applications"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All candidates
      </Link>

      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {app.candidateName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {app.job?.title ?? "—"}
            {app.yearsOfExperience != null && ` · ${app.yearsOfExperience} yrs experience`}
          </p>
          <p className="text-sm text-muted-foreground">
            {app.candidateEmail}
            {app.phone && <> · {app.phone}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={app.status} />
          {app.fitScore !== null && (
            <span className="text-lg font-bold tracking-tight">
              {app.fitScore}<span className="text-sm text-muted-foreground">/100</span>
            </span>
          )}
        </div>
      </header>

      {/* Cover letter (unchanged position above tabs) */}
      {app.coverLetter && (
        <section className="mb-6 rounded-lg border bg-card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cover letter
          </h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {app.coverLetter}
          </p>
        </section>
      )}

      {/* Tabbed content */}
      <div className="mb-6">
        <ApplicationTabs
          applicationId={app.id}
          candidateName={app.candidateName}
          screening={screening}
          enrichment={enrichment}
          resumeSignedUrl={resumeSignedUrl}
          resumeStatus={app.resumeUrl}
        />
      </div>

      {/* Action bar — ScreenActions hides itself when there are no actions to show */}
      <div className="mb-6">
        <ScreenActions
          applicationId={app.id}
          candidateName={app.candidateName}
          currentStatus={app.status}
          hasOfferedSlots={hasOfferedSlots}
        />
      </div>

      {/* Offer stage */}
      {(app.status === "POST_INTERVIEW" ||
        app.status === "OFFER_SENT" ||
        app.status === "OFFER_SIGNED" ||
        app.status === "ONBOARDED") && (
        <section className="mb-6 rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Offer</h2>
          {latestOffer ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {latestOffer.jobTitle} — ${latestOffer.baseSalary.toLocaleString("en-US")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Status: <span className="font-medium">{latestOffer.status}</span>
                  {latestOffer.sentAt && ` · Sent ${latestOffer.sentAt.toLocaleDateString()}`}
                  {latestOffer.signedAt && ` · Signed ${latestOffer.signedAt.toLocaleDateString()}`}
                </p>
              </div>
              <Link
                href={`/admin/offers/${latestOffer.id}`}
                className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Open offer →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Interview complete. Ready to generate the offer letter.
              </p>
              <SendOfferAccordion
                applicationId={app.id}
                candidateName={app.candidateName}
                jobTitle={app.job?.title ?? ""}
              />
            </>
          )}
        </section>
      )}

      {/* Interview transcript (only if an interview exists) */}
      {app.interview && (
        <section className="mb-6 rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Interview</h2>
            <div className="flex gap-2">
              {app.interview.status !== "COMPLETED" && (
                <SendBotButton
                  applicationId={app.id}
                  interviewStatus={app.interview.status}
                />
              )}
              {app.interview.status === "SCHEDULED" && (
                <SimulateInterviewButton applicationId={app.id} />
              )}
            </div>
          </div>

          {app.interview.transcriptSummary && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Summary
              </p>
              <p className="text-sm text-foreground">
                {app.interview.transcriptSummary}
              </p>
            </div>
          )}

          {(() => {
            const raw = app.interview!.transcriptRaw as {
              summary?: { keywords?: string[] };
            } | null;
            const keywords = raw?.summary?.keywords ?? [];
            if (keywords.length === 0) return null;
            return (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {app.interview.transcriptText && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                Get full transcript
              </summary>
              <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-4 font-mono text-xs text-foreground">
                {app.interview.transcriptText}
              </pre>
            </details>
          )}

          {app.interview.status === "COMPLETED" && !app.interview.transcriptText && (
            <p className="text-sm text-muted-foreground">Transcript unavailable.</p>
          )}
        </section>
      )}

    </main>
  );
}
