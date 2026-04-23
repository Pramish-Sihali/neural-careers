"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Canvas is client-only — disable SSR
const SignatureCanvas = dynamic(
  () => import("@/components/SignatureCanvas").then((m) => m.SignatureCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-lg border-2 border-dashed bg-gray-100" />
    ),
  }
);

type State = "idle" | "submitting" | "signed" | "error";

interface Props {
  offerId: string;
  token: string;
  alreadySigned: boolean;
  candidateName: string;
  jobTitle: string;
  signedAt: string | null;
}

export function OfferSignerClient({
  offerId,
  token,
  alreadySigned,
  candidateName,
  jobTitle,
  signedAt,
}: Props) {
  const [signatureBase64, setSignatureBase64] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<State>(alreadySigned ? "signed" : "idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [confirmationNumber, setConfirmationNumber] = useState<string>("");
  const [finalSignedAt, setFinalSignedAt] = useState<string | null>(signedAt);

  async function handleSubmit() {
    if (!signatureBase64 || !agreed) return;
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/offers/${offerId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureBase64 }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(body.error ?? "Failed to sign offer");
        return;
      }
      setConfirmationNumber(body.confirmationNumber ?? "");
      setFinalSignedAt(body.signedAt ?? null);
      setState("signed");
    } catch {
      setState("error");
      setErrorMsg("Network error — please try again");
    }
  }

  if (state === "signed") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="mb-2 text-3xl">✅</div>
        <h2 className="text-lg font-bold text-green-900">Offer signed</h2>
        <p className="mt-1 text-sm text-green-800">
          Thank you, {candidateName}. Your offer for <strong>{jobTitle}</strong> has been recorded.
        </p>
        {finalSignedAt && (
          <p className="mt-2 text-xs text-green-700">
            Signed on{" "}
            {new Date(finalSignedAt).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZoneName: "short",
            })}
          </p>
        )}
        {confirmationNumber && (
          <p className="mt-1 text-xs text-green-700">
            Confirmation: <span className="font-mono">{confirmationNumber}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-green-600 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
          >
            Download PDF
          </button>
        </div>
        <p className="mt-3 text-xs text-green-700">
          Clicking &quot;Download PDF&quot; opens your browser&apos;s print dialog —
          choose &quot;Save as PDF&quot; to keep a copy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Sign your offer</h2>
      <p className="text-sm text-gray-600">
        By signing below, you accept the terms of this offer letter.
        Your IP address, device, and the current timestamp will be recorded as evidence
        of intent and attribution.
      </p>

      <SignatureCanvas
        onSign={setSignatureBase64}
        onClear={() => setSignatureBase64("")}
        disabled={state === "submitting"}
      />

      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={state === "submitting"}
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
        />
        <span>
          I, <strong>{candidateName}</strong>, have read and accept the terms of this offer letter.
          I understand this constitutes a legally valid electronic signature.
        </span>
      </label>

      {state === "error" && errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!signatureBase64 || !agreed || state === "submitting"}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
      >
        {state === "submitting" ? "Submitting signature..." : "Sign & submit offer"}
      </button>
    </div>
  );
}
