import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { getOfferWithSignature } from "@/lib/services/offerService";
import { supabase } from "@/lib/supabase";
import {
  parseSlackOnboardingRow,
  type OfferStatus,
  type SlackOnboarding,
} from "@/lib/types/database";
import { OfferReviewClient } from "./OfferReviewClient";
import { SlackStatus } from "@/components/admin/SlackStatus";

const OFFER_STATUS_STYLE: Record<OfferStatus, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-gray-100 text-gray-700" },
  SENT:     { label: "Sent",     className: "bg-blue-100 text-blue-700" },
  SIGNED:   { label: "Signed",   className: "bg-teal-100 text-teal-700" },
  DECLINED: { label: "Declined", className: "bg-red-100 text-red-700" },
  EXPIRED:  { label: "Expired",  className: "bg-zinc-100 text-zinc-500" },
  VOIDED:   { label: "Voided",   className: "bg-red-100 text-red-700" },
};

function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const { label, className } = OFFER_STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function StatusChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        done
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      )}
      {label}
    </span>
  );
}

async function getSlackOnboarding(
  applicationId: string
): Promise<SlackOnboarding | null> {
  const { data } = await supabase
    .from("slack_onboardings")
    .select("*")
    .eq("applicationId", applicationId)
    .maybeSingle();
  return data
    ? parseSlackOnboardingRow(data as Record<string, unknown>)
    : null;
}

async function isCalendarConnected(): Promise<boolean> {
  if (process.env.USE_MOCK_CALENDAR === "true") return true;
  const { data } = await supabase
    .from("interviewer_credentials")
    .select("interviewerEmail")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function hasMeetLink(applicationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("interviews")
    .select("meetingUrl")
    .eq("applicationId", applicationId)
    .maybeSingle();
  return !!(data as { meetingUrl?: string | null } | null)?.meetingUrl;
}

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOfferReviewPage({ params }: PageProps) {
  const { id } = await params;
  const offer = await getOfferWithSignature(id);
  if (!offer) notFound();

  const app = offer.application;
  const slackOnboarding = app
    ? await getSlackOnboarding(app.id)
    : null;

  const [calendarConnected, meetLinkActive] = await Promise.all([
    isCalendarConnected(),
    app ? hasMeetLink(app.id) : Promise.resolve(false),
  ]);

  const slackInvited = !!slackOnboarding?.inviteEmailSentAt;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={app ? `/admin/applications/${app.id}` : "/admin/applications"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to application
      </Link>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offer letter
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {app?.candidateName ?? "Candidate"} — {offer.jobTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ${offer.baseSalary.toLocaleString("en-US")} ·{" "}
            {offer.startDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <OfferStatusBadge status={offer.status} />
      </header>

      {/* Status chips — data sourced from existing tables, no new API calls */}
      <section className="mb-6 flex flex-wrap gap-2">
        <StatusChip
          done={calendarConnected}
          label={calendarConnected ? "Google Calendar connected" : "Google Calendar not connected"}
        />
        <StatusChip
          done={meetLinkActive}
          label={meetLinkActive ? "Meet link active" : "No Meet link yet"}
        />
        <StatusChip
          done={slackInvited}
          label={slackInvited ? "Slack invite sent" : "Slack invite pending"}
        />
      </section>

      <OfferReviewClient
        offerId={offer.id}
        applicationId={offer.applicationId}
        status={offer.status}
        letterHtml={offer.letterHtml}
        candidateEmail={app?.candidateEmail ?? ""}
        sentAt={offer.sentAt?.toISOString() ?? null}
        signedAt={offer.signedAt?.toISOString() ?? null}
        letterHash={offer.letterHash}
        signature={
          offer.signature
            ? {
                id: offer.signature.id,
                ipAddress: offer.signature.ipAddress,
                userAgent: offer.signature.userAgent,
                signatureBase64: offer.signature.signatureBase64,
                signatureHash: offer.signature.signatureHash,
                signedAt: offer.signature.signedAt.toISOString(),
              }
            : null
        }
      />

      {/* Slack onboarding moved here from /admin/applications/[id] — the offer
          page is the single source of truth post-offer. */}
      {app && (
        <div className="mt-8">
          <SlackStatus
            applicationId={app.id}
            inviteEmailSentAt={slackOnboarding?.inviteEmailSentAt?.toISOString() ?? null}
            joinedAt={slackOnboarding?.joinedAt?.toISOString() ?? null}
            welcomeDmSentAt={slackOnboarding?.welcomeDmSentAt?.toISOString() ?? null}
            hrNotifiedAt={slackOnboarding?.hrNotifiedAt?.toISOString() ?? null}
            slackUserId={slackOnboarding?.slackUserId ?? null}
          />
        </div>
      )}
    </main>
  );
}
