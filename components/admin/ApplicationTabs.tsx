"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles } from "lucide-react";
import { ResumeViewer } from "./ResumeViewer";

export interface ScreeningSummary {
  strengths?: string[];
  gaps?: string[];
  rationale?: string;
  recommendation?: string;
}

export interface EnrichmentData {
  candidateBrief: string;
  githubDigest: unknown;
  discrepancies: unknown;
  linkedinSummary: string | null;
  twitterSummary: string | null;
}

interface Props {
  applicationId: string;
  screening: ScreeningSummary | null;
  enrichment: EnrichmentData | null;
  resumeSignedUrl: string | null;
  resumeStatus: string;
  candidateName: string;
}

export function ApplicationTabs({
  applicationId,
  screening,
  enrichment,
  resumeSignedUrl,
  resumeStatus,
  candidateName,
}: Props) {
  return (
    <Tabs defaultValue="screening" className="w-full">
      <TabsList className="grid grid-cols-4 w-full max-w-xl">
        <TabsTrigger value="screening">AI Screening</TabsTrigger>
        <TabsTrigger value="enrichment">AI Enrichment</TabsTrigger>
        <TabsTrigger value="notes">Interviewer Notes</TabsTrigger>
        <TabsTrigger value="resume">Resume</TabsTrigger>
      </TabsList>

      <TabsContent value="screening" className="mt-4">
        <ScreeningPanel screening={screening} />
      </TabsContent>

      <TabsContent value="enrichment" className="mt-4">
        <EnrichmentPanel
          applicationId={applicationId}
          enrichment={enrichment}
        />
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <InterviewerNotesPanel candidateName={candidateName} />
      </TabsContent>

      <TabsContent value="resume" className="mt-4">
        <ResumeViewer
          signedUrl={resumeSignedUrl}
          fallbackMessage={
            resumeStatus === "pending"
              ? "Upload pending — check back in a moment."
              : "Resume file unavailable."
          }
        />
      </TabsContent>
    </Tabs>
  );
}

function ScreeningPanel({ screening }: { screening: ScreeningSummary | null }) {
  if (!screening) {
    return (
      <EmptyState
        title="No AI screening run yet"
        description="Trigger a screen from the actions row above to see fit score, strengths, and gaps here."
      />
    );
  }
  return (
    <div className="space-y-5 rounded-lg border bg-card p-6">
      {screening.rationale && (
        <p className="text-sm text-foreground leading-relaxed">{screening.rationale}</p>
      )}
      {screening.strengths && screening.strengths.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">
            Strengths
          </p>
          <ul className="space-y-1">
            {screening.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-500" aria-hidden>
                  ✓
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {screening.gaps && screening.gaps.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500">
            Gaps
          </p>
          <ul className="space-y-1">
            {screening.gaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-red-400" aria-hidden>
                  ✗
                </span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EnrichmentPanel({
  applicationId,
  enrichment,
}: {
  applicationId: string;
  enrichment: EnrichmentData | null;
}) {
  const router = useRouter();
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    setRerunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/enrich`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Enrichment failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setRerunning(false);
    }
  }

  if (!enrichment) {
    return (
      <EmptyState
        title="No enrichment data yet"
        action={
          <button
            type="button"
            onClick={rerun}
            disabled={rerunning}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {rerunning ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Running…
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" /> Re-run enrichment
              </>
            )}
          </button>
        }
        description="Pull LinkedIn, GitHub, and web-search signals to see a candidate brief and flagged discrepancies."
      />
    );
  }

  return (
    <div className="space-y-5 rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Candidate brief
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {enrichment.candidateBrief}
          </p>
        </div>
        <button
          type="button"
          onClick={rerun}
          disabled={rerunning}
          className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {rerunning ? "Re-running…" : "Re-run"}
        </button>
      </div>

      {enrichment.linkedinSummary && (
        <Section title="LinkedIn">{enrichment.linkedinSummary}</Section>
      )}
      {enrichment.twitterSummary && (
        <Section title="Twitter / X">{enrichment.twitterSummary}</Section>
      )}
      {!!enrichment.githubDigest && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            GitHub digest
          </p>
          <pre className="overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(enrichment.githubDigest, null, 2)}
          </pre>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function InterviewerNotesPanel({ candidateName }: { candidateName: string }) {
  return (
    <div
      data-mock="true"
      className="space-y-4 rounded-lg border border-dashed bg-muted/30 p-6"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Mock
        </span>
        <h3 className="text-sm font-semibold text-muted-foreground">
          Interviewer Notes (AI-powered · coming soon)
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        A human-friendly synopsis of {candidateName} will land here once the
        AI-notes pipeline is wired up. Placeholder content below shows the
        intended shape.
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground/80">
        <li>
          • 5 years of commit history across TypeScript and Python repos
          concentrated in {" "}
          <em>distributed systems</em>.
        </li>
        <li>
          • Open-source maintainer of one mid-size library with ~1.2k stars.
        </li>
        <li>
          • Recent public writing is focused on agent evaluation and tool-use
          patterns.
        </li>
      </ul>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-6">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
