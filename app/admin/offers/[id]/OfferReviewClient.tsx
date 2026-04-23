"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SignatureInfo {
  id: string;
  ipAddress: string;
  userAgent: string;
  signatureBase64: string;
  signatureHash: string;
  signedAt: string;
}

interface Props {
  offerId: string;
  applicationId: string;
  status: string;
  letterHtml: string;
  candidateEmail: string;
  sentAt: string | null;
  signedAt: string | null;
  letterHash: string;
  signature: SignatureInfo | null;
}

export function OfferReviewClient({
  offerId,
  applicationId,
  status: initialStatus,
  letterHtml: initialLetterHtml,
  candidateEmail,
  sentAt: initialSentAt,
  signedAt,
  letterHash,
  signature,
}: Props) {
  const router = useRouter();
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  const [status, setStatus] = useState(initialStatus);
  const [letterHtml, setLetterHtml] = useState(initialLetterHtml);
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialLetterHtml);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function regenerateLetter() {
    if (
      !confirm(
        "Regenerate the offer letter from scratch? This replaces the current draft content."
      )
    )
      return;
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }
      accumulated += decoder.decode();

      if (accumulated.includes("[ERROR:")) {
        throw new Error("Gemini stream failed partway. Try again in a moment.");
      }

      const cleaned = accumulated
        .replace(/\n*\[OFFER_ID:[^\]]+\]\s*$/, "")
        .replace(/^\s*```(?:html)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      if (cleaned.length < 50) {
        throw new Error("Regenerated letter is too short. Try again.");
      }

      setLetterHtml(cleaned);
      setDraft(cleaned);
      setMessage({ kind: "success", text: "Letter regenerated" });
      router.refresh();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Regeneration failed",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ letterHtml: draft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setLetterHtml(draft);
      setEditing(false);
      setMessage({ kind: "success", text: "Draft saved" });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function sendOffer() {
    if (!confirm(`Send this offer to ${candidateEmail}? This freezes the letter content.`)) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Send failed");
      setStatus(body.status);
      setSentAt(body.sentAt);
      setMessage({ kind: "success", text: `Offer sent to ${body.sentTo}` });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(false);
    }
  }

  async function voidOffer() {
    if (!confirm("Void this offer? The candidate will no longer be able to sign it.")) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/void`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Void failed");
      setStatus(body.status);
      setMessage({ kind: "success", text: "Offer voided" });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Void failed" });
    } finally {
      setSending(false);
    }
  }

  const canEdit = status === "DRAFT";
  const canSend = status === "DRAFT" && letterHtml.trim().length >= 50;
  const canVoid = status === "DRAFT" || status === "SENT" || status === "SIGNED";

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-md border p-3 text-sm ${
            message.kind === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Metadata strip */}
      <section className="rounded-lg border bg-muted/30 p-4 text-xs">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
          <MetaItem label="Offer ID" value={offerId.slice(0, 8)} mono />
          <MetaItem label="Application" value={applicationId.slice(0, 8)} mono />
          {sentAt && <MetaItem label="Sent" value={new Date(sentAt).toLocaleString()} />}
          {signedAt && (
            <MetaItem label="Signed" value={new Date(signedAt).toLocaleString()} />
          )}
          {letterHash && (
            <MetaItem label="Letter hash" value={letterHash.slice(0, 12) + "…"} mono />
          )}
        </div>
      </section>

      {/* Letter body */}
      <section className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h2 className="text-sm font-semibold">Letter content</h2>
          {canEdit && !editing && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={regenerateLetter}
                disabled={regenerating}
                className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {regenerating ? "Regenerating..." : "Regenerate letter"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(letterHtml);
                  setEditing(true);
                }}
                disabled={regenerating}
                className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Edit draft
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-3 p-6">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-h-[480px] rounded-md border border-gray-300 p-4 font-mono text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <article
            className="prose max-w-none px-6 py-6"
            dangerouslySetInnerHTML={{ __html: letterHtml || "<p><em>No content yet.</em></p>" }}
          />
        )}
      </section>

      {/* Signature evidence */}
      {signature && (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold">Signature evidence</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Signature
              </p>
              {signature.signatureBase64.startsWith("data:image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signature.signatureBase64}
                  alt="Candidate signature"
                  className="rounded border bg-white p-2"
                  style={{ maxHeight: "160px" }}
                />
              ) : (
                <p className="text-xs text-gray-400">(no preview)</p>
              )}
            </div>
            <div className="space-y-2 text-xs text-gray-700">
              <MetaItem label="IP address" value={signature.ipAddress} mono block />
              <MetaItem label="User agent" value={signature.userAgent} mono block />
              <MetaItem
                label="Signature hash"
                value={signature.signatureHash.slice(0, 24) + "…"}
                mono
                block
              />
              <MetaItem
                label="Signed at"
                value={new Date(signature.signedAt).toLocaleString()}
                block
              />
            </div>
          </div>
        </section>
      )}

      {/* Action bar */}
      <section className="flex flex-wrap items-center gap-2 border-t pt-6">
        {canSend && (
          <button
            type="button"
            onClick={sendOffer}
            disabled={sending}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : `Send for signature → ${candidateEmail}`}
          </button>
        )}
        {canVoid && (
          <button
            type="button"
            onClick={voidOffer}
            disabled={sending}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Void offer
          </button>
        )}
      </section>
    </div>
  );
}

function MetaItem({
  label,
  value,
  mono,
  block,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <div className={block ? "space-y-0.5" : "flex flex-col"}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={`text-xs text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
