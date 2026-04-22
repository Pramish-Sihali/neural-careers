import { supabase } from "@/lib/supabase";
import {
  parseOfferRow,
  parseOfferSignatureRow,
} from "@/lib/types/database";
import type {
  Offer,
  OfferSignature,
  OfferStatus,
} from "@/lib/types/database";
import { generateId, now } from "@/lib/utils/apiHelpers";

export interface OfferCreateData {
  applicationId: string;
  jobTitle: string;
  startDate: Date;
  baseSalary: number;
  compensationStructure: string;
  equity?: string | null;
  bonus?: string | null;
  reportingManager: string;
  customTerms?: string | null;
}

export async function createDraftOffer(data: OfferCreateData): Promise<Offer> {
  const nowIso = now();
  const { data: row, error } = await supabase
    .from("offers")
    .insert({
      id: generateId(),
      applicationId: data.applicationId,
      jobTitle: data.jobTitle,
      startDate: data.startDate.toISOString(),
      baseSalary: data.baseSalary,
      compensationStructure: data.compensationStructure,
      equity: data.equity ?? null,
      bonus: data.bonus ?? null,
      reportingManager: data.reportingManager,
      customTerms: data.customTerms ?? null,
      letterHtml: "",
      letterHash: "",
      status: "DRAFT",
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferRow(row as Record<string, unknown>);
}

export async function getOfferById(id: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, application:applications(*, job:jobs(*))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseOfferRow(data as Record<string, unknown>) : null;
}

export async function getOfferWithSignature(id: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, application:applications(*, job:jobs(*)), signature:offer_signatures(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  // Supabase returns 1:1 joins as arrays; normalize to single object or null
  if (Array.isArray(row.signature)) {
    row.signature = row.signature.length > 0 ? row.signature[0] : null;
  }
  return parseOfferRow(row);
}

export async function findLatestOfferForApplication(
  applicationId: string
): Promise<Offer | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("applicationId", applicationId)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseOfferRow(data as Record<string, unknown>) : null;
}

export async function updateOfferDraft(
  id: string,
  letterHtml: string
): Promise<Offer> {
  const { data, error } = await supabase
    .from("offers")
    .update({ letterHtml, updatedAt: now() })
    .eq("id", id)
    .eq("status", "DRAFT")
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferRow(data as Record<string, unknown>);
}

export async function markOfferSent(
  id: string,
  letterHtml: string,
  letterHash: string
): Promise<Offer> {
  const nowIso = now();
  const { data, error } = await supabase
    .from("offers")
    .update({
      status: "SENT",
      letterHtml,
      letterHash,
      sentAt: nowIso,
      updatedAt: nowIso,
    })
    .eq("id", id)
    .eq("status", "DRAFT")
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferRow(data as Record<string, unknown>);
}

export async function markOfferSigned(id: string): Promise<Offer> {
  const nowIso = now();
  const { data, error } = await supabase
    .from("offers")
    .update({ status: "SIGNED", signedAt: nowIso, updatedAt: nowIso })
    .eq("id", id)
    .eq("status", "SENT")
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferRow(data as Record<string, unknown>);
}

export async function markOfferStatus(
  id: string,
  status: OfferStatus
): Promise<Offer> {
  const { data, error } = await supabase
    .from("offers")
    .update({ status, updatedAt: now() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferRow(data as Record<string, unknown>);
}

export async function findExpiredSentOffers(
  thresholdSentAt: Date
): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("status", "SENT")
    .lt("sentAt", thresholdSentAt.toISOString());
  if (error) throw error;
  return (data ?? []).map((row) => parseOfferRow(row as Record<string, unknown>));
}

export async function createSignatureRecord(data: {
  offerId: string;
  candidateId: string;
  signatureBase64: string;
  ipAddress: string;
  userAgent: string;
  signatureHash: string;
}): Promise<OfferSignature> {
  const nowIso = now();
  const { data: row, error } = await supabase
    .from("offer_signatures")
    .insert({
      id: generateId(),
      offerId: data.offerId,
      candidateId: data.candidateId,
      signatureBase64: data.signatureBase64,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      signatureHash: data.signatureHash,
      signedAt: nowIso,
      createdAt: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return parseOfferSignatureRow(row as Record<string, unknown>);
}

export async function getSignatureForOffer(
  offerId: string
): Promise<OfferSignature | null> {
  const { data, error } = await supabase
    .from("offer_signatures")
    .select("*")
    .eq("offerId", offerId)
    .maybeSingle();
  if (error) throw error;
  return data ? parseOfferSignatureRow(data as Record<string, unknown>) : null;
}
