import { OfferStatus } from "@/lib/types/database";

export class InvalidOfferTransitionError extends Error {
  constructor(current: OfferStatus, next: OfferStatus) {
    super(`Invalid offer transition: ${current} → ${next}`);
    this.name = "InvalidOfferTransitionError";
  }
}

const ALLOWED_OFFER_TRANSITIONS: Partial<Record<OfferStatus, OfferStatus[]>> = {
  DRAFT: ["SENT", "VOIDED"],
  SENT: ["SIGNED", "DECLINED", "EXPIRED", "VOIDED"],
  SIGNED: ["VOIDED"],
};

export function validateOfferTransition(
  current: OfferStatus,
  next: OfferStatus
): void {
  const reachable = ALLOWED_OFFER_TRANSITIONS[current];
  if (!reachable || !reachable.includes(next)) {
    throw new InvalidOfferTransitionError(current, next);
  }
}

export function canTransitionOffer(
  current: OfferStatus,
  next: OfferStatus
): boolean {
  const reachable = ALLOWED_OFFER_TRANSITIONS[current];
  return Boolean(reachable && reachable.includes(next));
}
