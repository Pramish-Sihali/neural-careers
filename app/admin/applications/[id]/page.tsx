import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { parseApplicationRow, parseSlackOnboardingRow } from "@/lib/types/database";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ScreenActions } from "@/components/admin/ScreenActions";
import { SimulateInterviewButton } from "@/components/admin/SimulateInterviewButton";
import { SendBotButton } from "@/components/admin/SendBotButton";
import { GenerateOfferButton } from "@/components/admin/GenerateOfferButton";
import { SlackStatus } from "@/components/admin/SlackStatus";
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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(storagePath, 60 * 30); // 30 min — path is already relative to bucket root
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

  const { data: slackOnboardingRow } = await supabase
    .from("slack_onboardings").select("*").eq("applicationId", id).maybeSingle();
  const slackOnboarding = slackOnboardingRow
    ? parseSlackOnboardingRow(slackOnboardingRow as Record<string, unknown>)
    : null;

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
          {app.phone && (
            <p className="text-sm text-muted-foreground">{app.phone}</p>
          )}
          <p className="text-sm text-muted-foreground">{app.job?.title}</p>
          {app.yearsOfExperience != null && (
            <p className="text-sm text-muted-foreground">{app.yearsOfExperience} yrs experience</p>
          )}
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
        <ScreenActions applicationId={app.id} candidateName={app.candidateName} currentStatus={app.status} />

        {/* Offer stage */}
        {(app.status === "POST_INTERVIEW" ||
          app.status === "OFFER_SENT" ||
          app.status === "OFFER_SIGNED" ||
          app.status === "ONBOARDED") && (
          <section className="rounded-lg border p-6 space-y-3">
            <h2 className="font-semibold">Offer</h2>
            {latestOffer ? (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {latestOffer.jobTitle} — ${latestOffer.baseSalary.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                <GenerateOfferButton
                  applicationId={app.id}
                  candidateName={app.candidateName}
                  jobTitle={app.job?.title ?? ""}
                />
              </>
            )}
          </section>
        )}

        {/* Cover letter */}
        {app.coverLetter && (
          <section className="rounded-lg border p-6">
            <h2 className="font-semibold mb-3">Cover Letter</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{app.coverLetter}</p>
          </section>
        )}

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
            {!!app.enrichment.githubDigest && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">GitHub</p>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto">
                  {JSON.stringify(app.enrichment.githubDigest, null, 2)}
                </pre>
              </div>
            )}
          </section>
        )}

        {/* Interview Transcript */}
        {app.interview && (
          <section className="rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold">Interview</h2>

            {app.interview.status !== "COMPLETED" && (
              <SendBotButton
                applicationId={app.id}
                interviewStatus={app.interview.status}
              />
            )}

            {app.interview.status === "SCHEDULED" && (
              <SimulateInterviewButton applicationId={app.id} />
            )}

            {app.interview.status === "COMPLETED" && !app.interview.transcriptText && (
              <p className="text-sm text-muted-foreground">Transcript unavailable.</p>
            )}

            {app.interview.transcriptText && (() => {
              const raw = app.interview!.transcriptRaw as {
                summary?: { action_items?: string[]; keywords?: string[] };
              } | null;

              return (
                <div className="space-y-4">
                  {/* Summary */}
                  {app.interview!.transcriptSummary && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Summary
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {app.interview!.transcriptSummary}
                      </p>
                    </div>
                  )}

                  {/* Action items */}
                  {(raw?.summary?.action_items ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Action Items
                      </p>
                      <ul className="space-y-1">
                        {(raw!.summary!.action_items!).map((item, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-muted-foreground">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Keywords */}
                  {(raw?.summary?.keywords ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Keywords
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(raw!.summary!.keywords!).map((kw, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full transcript */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Transcript
                    </p>
                    {app.interview!.transcriptText ? (
                      <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono bg-muted rounded p-4 max-h-96 overflow-y-auto">
                        {app.interview!.transcriptText}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No transcript content.</p>
                    )}
                  </div>

                  {/* AI Scorecard placeholder */}
                  <div className="rounded-lg border border-dashed p-4 opacity-50 select-none">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">🔒</span>
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        AI Scorecard
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Coming soon — Gemini-powered interview analysis.</p>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Resume file */}
        <section className="rounded-lg border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Resume File
            </h2>
            {resumeSignedUrl ? (
              <a
                href={resumeSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Open PDF <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                {app.resumeUrl === "pending" ? "Upload pending" : "File unavailable"}
              </span>
            )}
          </div>
          {resumeSignedUrl && (
            <iframe
              src={resumeSignedUrl}
              className="w-full rounded border bg-muted"
              style={{ height: "600px" }}
              title="Candidate resume"
            />
          )}
        </section>

        {/* Resume text */}
        <section className="rounded-lg border p-6">
          <h2 className="font-semibold mb-3">Resume Text (parsed)</h2>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-y-auto">
            {app.resumeText}
          </pre>
        </section>

        {/* Slack onboarding */}
        <SlackStatus
          applicationId={app.id}
          inviteEmailSentAt={slackOnboarding?.inviteEmailSentAt?.toISOString() ?? null}
          joinedAt={slackOnboarding?.joinedAt?.toISOString() ?? null}
          welcomeDmSentAt={slackOnboarding?.welcomeDmSentAt?.toISOString() ?? null}
          hrNotifiedAt={slackOnboarding?.hrNotifiedAt?.toISOString() ?? null}
          slackUserId={slackOnboarding?.slackUserId ?? null}
        />
      </div>
    </main>
  );
}
