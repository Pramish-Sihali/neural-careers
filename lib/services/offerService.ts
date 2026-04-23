import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { getModel } from "@/lib/ai/client";
import {
  OFFER_LETTER_SYSTEM_PROMPT,
  buildOfferPrompt,
  type OfferPromptInput,
} from "@/lib/ai/prompts/generateOffer";
import {
  createDraftOffer,
  getOfferById,
  getOfferWithSignature,
  markOfferSent,
  markOfferSigned,
  markOfferStatus,
  createSignatureRecord,
  getSignatureForOffer,
  findExpiredSentOffers,
  updateOfferDraft,
  type OfferCreateData,
} from "@/lib/repositories/offerRepo";
import { getApplicationById } from "@/lib/repositories/applicationRepo";
import { signOfferToken } from "@/lib/auth/offerToken";
import { getEmailService } from "@/lib/integrations/email";
import { renderOfferLetterEmail } from "@/emails/OfferLetter";
import { renderOfferSignedEmail } from "@/emails/OfferSigned";
import { validateOfferTransition } from "@/lib/domain/offerStateMachine";
import { generateId, now } from "@/lib/utils/apiHelpers";
import type { Offer, OfferSignature } from "@/lib/types/database";
import { sendOnboardingInvite } from "./onboardingService";

export class OfferError extends Error {}
export class OfferNotFoundError extends OfferError {}
export class OfferStateError extends OfferError {}
export class SignatureTooSmallError extends OfferError {}

export const OFFER_EXPIRY_DAYS = 7;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function stripHtmlFences(text: string): string {
  return text
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Creates an empty DRAFT offer and streams the generated letter HTML from Gemini.
 * Returns a tuple: the DRAFT offer row and an async iterator of text chunks.
 * The caller is responsible for persisting the final letterHtml via updateDraft().
 */
export async function generateOfferDraft(
  data: OfferCreateData & { candidateName: string }
): Promise<{
  offer: Offer;
  stream: AsyncIterable<string>;
  finalize: (accumulated: string) => Promise<void>;
}> {
  const app = await getApplicationById(data.applicationId);
  if (!app) throw new OfferNotFoundError("Application not found");
  if (app.status !== "POST_INTERVIEW") {
    throw new OfferStateError(
      `Application must be in POST_INTERVIEW to generate an offer (current: ${app.status})`
    );
  }

  const offer = await createDraftOffer(data);

  const promptInput: OfferPromptInput = {
    candidateName: data.candidateName,
    jobTitle: data.jobTitle,
    startDate: data.startDate,
    baseSalary: data.baseSalary,
    compensationStructure: data.compensationStructure,
    equity: data.equity ?? null,
    bonus: data.bonus ?? null,
    reportingManager: data.reportingManager,
    customTerms: data.customTerms ?? null,
  };

  const model = getModel();
  const streamResult = await model.generateContentStream({
    systemInstruction: OFFER_LETTER_SYSTEM_PROMPT,
    contents: [{ role: "user", parts: [{ text: buildOfferPrompt(promptInput) }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
  });

  async function* chunks(): AsyncIterable<string> {
    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  async function finalize(accumulated: string): Promise<void> {
    const cleaned = stripHtmlFences(accumulated);
    await updateOfferDraft(offer.id, cleaned);
    await supabase.from("events_log").insert({
      id: generateId(),
      applicationId: data.applicationId,
      eventType: "OFFER_GENERATED",
      payload: { offerId: offer.id, length: cleaned.length },
      idempotencyKey: `offer-generated:${offer.id}`,
      createdAt: now(),
    });
  }

  return { offer, stream: chunks(), finalize };
}

/** Update draft letter content (admin edit) — only while DRAFT. */
export async function editDraft(offerId: string, letterHtml: string): Promise<Offer> {
  const existing = await getOfferById(offerId);
  if (!existing) throw new OfferNotFoundError("Offer not found");
  if (existing.status !== "DRAFT") {
    throw new OfferStateError("Offer is no longer editable");
  }
  return updateOfferDraft(offerId, letterHtml);
}

/** Freeze draft, send email, advance application status. */
export async function sendOffer(
  offerId: string,
  customNote?: string | null
): Promise<{ offer: Offer; sentTo: string }> {
  const existing = await getOfferById(offerId);
  if (!existing) throw new OfferNotFoundError("Offer not found");
  if (existing.status === "SENT") {
    // Idempotent: already sent
    const app = await getApplicationById(existing.applicationId);
    return { offer: existing, sentTo: app?.candidateEmail ?? "" };
  }
  validateOfferTransition(existing.status, "SENT");
  if (!existing.letterHtml || existing.letterHtml.trim().length < 50) {
    throw new OfferStateError("Letter content is empty or too short to send");
  }

  const letterHash = sha256(existing.letterHtml);
  const updated = await markOfferSent(offerId, existing.letterHtml, letterHash);

  const app = await getApplicationById(updated.applicationId);
  if (!app) throw new OfferNotFoundError("Application not found");

  const token = await signOfferToken(offerId, "view-offer");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const signingUrl = `${appUrl}/offers/${offerId}?token=${token}`;

  const html = renderOfferLetterEmail({
    candidateName: app.candidateName,
    jobTitle: updated.jobTitle,
    signingUrl,
    customNote: customNote ?? null,
  });

  await getEmailService().send({
    to: app.candidateEmail,
    subject: `Your offer from Niural — ${updated.jobTitle}`,
    html,
  });

  const nowIso = now();
  await supabase
    .from("applications")
    .update({ status: "OFFER_SENT", updatedAt: nowIso })
    .eq("id", updated.applicationId);

  await supabase.from("events_log").insert({
    id: generateId(),
    applicationId: updated.applicationId,
    eventType: "OFFER_SENT",
    payload: { offerId, letterHash },
    idempotencyKey: `offer-sent:${offerId}`,
    createdAt: nowIso,
  });

  return { offer: updated, sentTo: app.candidateEmail };
}

interface SignOfferInput {
  offerId: string;
  signatureBase64: string;
  ipAddress: string;
  userAgent: string;
}

export async function signOffer(input: SignOfferInput): Promise<{
  offer: Offer;
  signature: OfferSignature;
  alreadySigned: boolean;
}> {
  const existing = await getOfferById(input.offerId);
  if (!existing) throw new OfferNotFoundError("Offer not found");

  // Idempotency — already signed returns existing record
  if (existing.status === "SIGNED") {
    const existingSig = await getSignatureForOffer(input.offerId);
    if (!existingSig) {
      throw new OfferError("Offer marked signed but signature record is missing");
    }
    return { offer: existing, signature: existingSig, alreadySigned: true };
  }

  if (existing.status !== "SENT") {
    throw new OfferStateError(
      `Offer cannot be signed in current status: ${existing.status}`
    );
  }

  // Check expiry (7 days from sentAt)
  if (
    existing.sentAt &&
    Date.now() - existing.sentAt.getTime() > OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ) {
    throw new OfferStateError("Offer has expired");
  }

  validateOfferTransition(existing.status, "SIGNED");

  // Minimum-ink check — reject essentially blank signatures
  if (input.signatureBase64.length < 200) {
    throw new SignatureTooSmallError("Signature appears empty");
  }

  const app = await getApplicationById(existing.applicationId);
  if (!app) throw new OfferNotFoundError("Application not found");

  const nowIso = now();
  const signatureHash = sha256(
    `${input.signatureBase64}${app.id}${nowIso}`
  );

  const signature = await createSignatureRecord({
    offerId: input.offerId,
    candidateId: app.id,
    signatureBase64: input.signatureBase64,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    signatureHash,
  });

  const updated = await markOfferSigned(input.offerId);

  await supabase
    .from("applications")
    .update({ status: "OFFER_SIGNED", updatedAt: nowIso })
    .eq("id", existing.applicationId);

  // Notify hiring manager
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const adminOfferUrl = `${appUrl}/admin/offers/${input.offerId}`;
  const hiringManagerEmail =
    process.env.HIRING_MANAGER_EMAIL ??
    process.env.INTERVIEWER_EMAIL ??
    "hiring@niural.com";

  await getEmailService()
    .send({
      to: hiringManagerEmail,
      subject: `Offer signed — ${app.candidateName} (${updated.jobTitle})`,
      html: renderOfferSignedEmail({
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        jobTitle: updated.jobTitle,
        signedAt: updated.signedAt ?? new Date(),
        adminOfferUrl,
      }),
    })
    .catch((err) => {
      // Non-fatal: signature is already persisted
      console.error("Offer-signed notification failed:", err);
    });

  await supabase.from("events_log").insert({
    id: generateId(),
    applicationId: existing.applicationId,
    eventType: "OFFER_SIGNED",
    payload: { offerId: input.offerId, signatureId: signature.id },
    idempotencyKey: `offer-signed:${input.offerId}`,
    createdAt: nowIso,
  });

  await sendOnboardingInvite(existing.applicationId).catch((err) => {
    console.error("Slack onboarding invite failed:", err);
  });

  return { offer: updated, signature, alreadySigned: false };
}

export async function voidOffer(offerId: string): Promise<Offer> {
  const existing = await getOfferById(offerId);
  if (!existing) throw new OfferNotFoundError("Offer not found");
  validateOfferTransition(existing.status, "VOIDED");
  const updated = await markOfferStatus(offerId, "VOIDED");

  // If the application was already OFFER_SENT/OFFER_SIGNED, revert to REJECTED
  if (
    existing.status === "SENT" ||
    existing.status === "SIGNED" ||
    existing.status === "DRAFT"
  ) {
    await supabase
      .from("applications")
      .update({ status: "REJECTED", updatedAt: now() })
      .eq("id", existing.applicationId);
  }

  return updated;
}

/** Returns {expired, offerIds}. Called by cron. */
export async function expireSentOffers(): Promise<{
  expired: number;
  offerIds: string[];
}> {
  const threshold = new Date(Date.now() - OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const stale = await findExpiredSentOffers(threshold);
  if (stale.length === 0) return { expired: 0, offerIds: [] };

  const ids: string[] = [];
  for (const offer of stale) {
    await markOfferStatus(offer.id, "EXPIRED");
    ids.push(offer.id);
  }
  return { expired: stale.length, offerIds: ids };
}

export { getOfferWithSignature };
