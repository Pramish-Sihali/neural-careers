import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOfferWithSignature } from "@/lib/services/offerService";
import type { OfferStatus } from "@/lib/types/database";
import { OfferReviewClient } from "./OfferReviewClient";

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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={app ? `/admin/applications/${app.id}` : "/admin/applications"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to application
      </Link>

      <header className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offer letter
          </p>
          <h1 className="mt-1 text-2xl font-bold">
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
    </main>
  );
}
