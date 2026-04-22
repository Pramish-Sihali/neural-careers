import { notFound } from "next/navigation";
import { verifyOfferToken } from "@/lib/auth/offerToken";
import { getOfferWithSignature } from "@/lib/services/offerService";
import { OfferSignerClient } from "./OfferSignerClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function CandidateOfferPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorCard
        title="Missing link"
        message="This page requires a valid signing link from your email."
      />
    );
  }

  let tokenOfferId: string | null = null;
  try {
    try {
      tokenOfferId = await verifyOfferToken(token, "view-offer");
    } catch {
      tokenOfferId = await verifyOfferToken(token, "sign-offer");
    }
  } catch {
    return (
      <ErrorCard
        title="Link invalid or expired"
        message="This offer link has expired. Please contact the hiring team for a new link."
      />
    );
  }

  if (tokenOfferId !== id) {
    return <ErrorCard title="Link mismatch" message="This link does not match this offer." />;
  }

  const offer = await getOfferWithSignature(id);
  if (!offer) notFound();

  if (offer.status === "VOIDED") {
    return (
      <ErrorCard
        title="Offer rescinded"
        message="This offer has been rescinded. Please contact the hiring team."
      />
    );
  }

  if (offer.status === "EXPIRED") {
    return (
      <ErrorCard
        title="Offer expired"
        message="This offer has expired. Please contact the hiring team."
      />
    );
  }

  const app = offer.application;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border bg-white shadow-sm">
          <header className="border-b px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Offer letter
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {app?.candidateName ?? "Candidate"} — {offer.jobTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              From Niural · Sent{" "}
              {offer.sentAt
                ? offer.sentAt.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </header>

          <article
            className="prose max-w-none px-8 py-8 text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: offer.letterHtml }}
          />

          <div className="border-t px-8 py-8">
            <OfferSignerClient
              offerId={offer.id}
              token={token}
              alreadySigned={offer.status === "SIGNED"}
              candidateName={app?.candidateName ?? ""}
              jobTitle={offer.jobTitle}
              signedAt={offer.signedAt?.toISOString() ?? null}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          This page is a legally valid electronic signature portal under the ESIGN Act.
          Your IP address, device, and timestamp will be recorded on signing.
        </p>
      </div>
    </main>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <a
          href="mailto:hiring@niural.com"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Contact hiring@niural.com
        </a>
      </div>
    </main>
  );
}
