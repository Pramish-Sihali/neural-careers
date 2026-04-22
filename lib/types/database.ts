// Enum constants — runtime values AND types via the const enum pattern.
// Import from here instead of @prisma/client.

export const ApplicationStatus = {
  APPLIED: "APPLIED",
  SCREENED: "SCREENED",
  SHORTLISTED: "SHORTLISTED",
  INTERVIEWING: "INTERVIEWING",
  POST_INTERVIEW: "POST_INTERVIEW",
  OFFER_SENT: "OFFER_SENT",
  OFFER_SIGNED: "OFFER_SIGNED",
  ONBOARDED: "ONBOARDED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const SlotStatus = {
  HELD: "HELD",
  CONFIRMED: "CONFIRMED",
  RELEASED: "RELEASED",
  EXPIRED: "EXPIRED",
} as const;
export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const OfferStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  SIGNED: "SIGNED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  VOIDED: "VOIDED",
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const InterviewStatus = {
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
} as const;
export type InterviewStatus = (typeof InterviewStatus)[keyof typeof InterviewStatus];

export const EventType = {
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  APPLICATION_SCREENED: "APPLICATION_SCREENED",
  CANDIDATE_SHORTLISTED: "CANDIDATE_SHORTLISTED",
  CANDIDATE_REJECTED: "CANDIDATE_REJECTED",
  SLOTS_OFFERED: "SLOTS_OFFERED",
  SLOT_CONFIRMED: "SLOT_CONFIRMED",
  INTERVIEW_COMPLETED: "INTERVIEW_COMPLETED",
  OFFER_GENERATED: "OFFER_GENERATED",
  OFFER_SENT: "OFFER_SENT",
  OFFER_SIGNED: "OFFER_SIGNED",
  SLACK_INVITED: "SLACK_INVITED",
  SLACK_JOINED: "SLACK_JOINED",
  NUDGE_SENT: "NUDGE_SENT",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

// Row shapes — match Prisma-generated types (Date objects, not strings)

export interface Job {
  id: string;
  title: string;
  team: string;
  location: string;
  remote: boolean;
  experienceLevel: string;
  description: string;
  responsibilities: string;
  requirements: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  id: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  linkedinUrl: string | null;
  githubUrl: string | null;
  phone: string | null;
  yearsOfExperience: number | null;
  coverLetter: string | null;
  resumeUrl: string;
  resumeText: string;
  status: ApplicationStatus;
  fitScore: number | null;
  screeningSummary: unknown;
  version: number;
  screenedAt: Date | null;
  shortlistedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional joined relations
  job?: Job;
  enrichment?: CandidateEnrichment | null;
  interview?: Interview | null;
  interviewSlots?: InterviewSlot[];
}

export interface CandidateEnrichment {
  id: string;
  applicationId: string;
  linkedinUrl: string | null;
  linkedinSummary: string | null;
  githubUsername: string | null;
  githubDigest: unknown;
  twitterSummary: string | null;
  candidateBrief: string;
  discrepancies: unknown;
  enrichedAt: Date;
}

export interface InterviewSlot {
  id: string;
  applicationId: string;
  interviewerEmail: string;
  startTime: Date;
  endTime: Date;
  status: SlotStatus;
  googleEventId: string | null;
  holdExpiresAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional joined relations
  application?: Application & { job?: Job };
  interview?: Interview | null;
}

export interface Interview {
  id: string;
  applicationId: string;
  slotId: string;
  firefliesMeetingId: string | null;
  meetingUrl: string | null;
  transcriptRaw: unknown;
  transcriptText: string | null;
  transcriptSummary: string | null;
  aiScorecard: unknown;
  status: InterviewStatus;
  scheduledAt: Date;
  completedAt: Date | null;
  transcriptFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional joined relation
  application?: { id: string; candidateName: string };
}

export interface InterviewerCredentials {
  id: string;
  interviewerEmail: string;
  encryptedTokens: string;
  isConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledNudge {
  id: string;
  applicationId: string;
  nudgeType: string;
  scheduledFor: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface SlackOnboarding {
  id:                 string;
  applicationId:      string;
  inviteEmailSentAt:  Date | null;
  slackUserId:        string | null;
  joinedAt:           Date | null;
  welcomeDmSentAt:    Date | null;
  hrNotifiedAt:       Date | null;
  createdAt:          Date;
  updatedAt:          Date;
}

export function parseSlackOnboardingRow(row: Record<string, unknown>): SlackOnboarding {
  return {
    id:                row.id as string,
    applicationId:     row.applicationId as string,
    inviteEmailSentAt: dn(row.inviteEmailSentAt as string | null),
    slackUserId:       (row.slackUserId as string | null) ?? null,
    joinedAt:          dn(row.joinedAt as string | null),
    welcomeDmSentAt:   dn(row.welcomeDmSentAt as string | null),
    hrNotifiedAt:      dn(row.hrNotifiedAt as string | null),
    createdAt:         d(row.createdAt as string),
    updatedAt:         d(row.updatedAt as string),
  };
}

export interface Offer {
  id: string;
  applicationId: string;
  jobTitle: string;
  startDate: Date;
  baseSalary: number; // whole USD
  compensationStructure: string;
  equity: string | null;
  bonus: string | null;
  reportingManager: string;
  customTerms: string | null;
  letterHtml: string;
  letterHash: string;
  status: OfferStatus;
  sentAt: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional joined relations
  application?: Application;
  signature?: OfferSignature | null;
}

export interface OfferSignature {
  id: string;
  offerId: string;
  candidateId: string;
  signatureBase64: string;
  ipAddress: string;
  userAgent: string;
  signedAt: Date;
  signatureHash: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Date-parsing helpers — Supabase returns ISO strings; convert to Date objects
// ---------------------------------------------------------------------------

function d(s: string): Date { return new Date(s); }
function dn(s: string | null | undefined): Date | null { return s ? new Date(s) : null; }

export function parseJobRow(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    title: row.title as string,
    team: row.team as string,
    location: row.location as string,
    remote: row.remote as boolean,
    experienceLevel: row.experienceLevel as string,
    description: row.description as string,
    responsibilities: row.responsibilities as string,
    requirements: row.requirements as string,
    isActive: row.isActive as boolean,
    createdAt: d(row.createdAt as string),
    updatedAt: d(row.updatedAt as string),
  };
}

export function parseApplicationRow(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    jobId: row.jobId as string,
    candidateName: row.candidateName as string,
    candidateEmail: row.candidateEmail as string,
    linkedinUrl: (row.linkedinUrl as string | null) ?? null,
    githubUrl: (row.githubUrl as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    yearsOfExperience: (row.yearsOfExperience as number | null) ?? null,
    coverLetter: (row.coverLetter as string | null) ?? null,
    resumeUrl: row.resumeUrl as string,
    resumeText: row.resumeText as string,
    status: row.status as ApplicationStatus,
    fitScore: (row.fitScore as number | null) ?? null,
    screeningSummary: row.screeningSummary ?? null,
    version: row.version as number,
    screenedAt: dn(row.screenedAt as string | null),
    shortlistedAt: dn(row.shortlistedAt as string | null),
    createdAt: d(row.createdAt as string),
    updatedAt: d(row.updatedAt as string),
    ...(row.job ? { job: parseJobRow(row.job as Record<string, unknown>) } : {}),
    ...(row.enrichment !== undefined
      ? { enrichment: row.enrichment ? parseCandidateEnrichmentRow(row.enrichment as Record<string, unknown>) : null }
      : {}),
    ...(row.interview !== undefined
      ? { interview: row.interview ? parseInterviewRow(row.interview as Record<string, unknown>) : null }
      : {}),
    ...(row.interviewSlots
      ? { interviewSlots: (row.interviewSlots as Record<string, unknown>[]).map(parseInterviewSlotRow) }
      : {}),
  };
}

export function parseCandidateEnrichmentRow(row: Record<string, unknown>): CandidateEnrichment {
  return {
    id: row.id as string,
    applicationId: row.applicationId as string,
    linkedinUrl: (row.linkedinUrl as string | null) ?? null,
    linkedinSummary: (row.linkedinSummary as string | null) ?? null,
    githubUsername: (row.githubUsername as string | null) ?? null,
    githubDigest: row.githubDigest ?? null,
    twitterSummary: (row.twitterSummary as string | null) ?? null,
    candidateBrief: row.candidateBrief as string,
    discrepancies: row.discrepancies ?? [],
    enrichedAt: d(row.enrichedAt as string),
  };
}

export function parseInterviewSlotRow(row: Record<string, unknown>): InterviewSlot {
  return {
    id: row.id as string,
    applicationId: row.applicationId as string,
    interviewerEmail: row.interviewerEmail as string,
    startTime: d(row.startTime as string),
    endTime: d(row.endTime as string),
    status: row.status as SlotStatus,
    googleEventId: (row.googleEventId as string | null) ?? null,
    holdExpiresAt: d(row.holdExpiresAt as string),
    confirmedAt: dn(row.confirmedAt as string | null),
    releasedAt: dn(row.releasedAt as string | null),
    createdAt: d(row.createdAt as string),
    updatedAt: d(row.updatedAt as string),
    ...(row.application
      ? {
          application: {
            ...parseApplicationRow(row.application as Record<string, unknown>),
            ...(((row.application as Record<string, unknown>).job)
              ? { job: parseJobRow(((row.application as Record<string, unknown>).job) as Record<string, unknown>) }
              : {}),
          },
        }
      : {}),
  };
}

export function parseOfferRow(row: Record<string, unknown>): Offer {
  return {
    id: row.id as string,
    applicationId: row.applicationId as string,
    jobTitle: row.jobTitle as string,
    startDate: d(row.startDate as string),
    baseSalary: row.baseSalary as number,
    compensationStructure: row.compensationStructure as string,
    equity: (row.equity as string | null) ?? null,
    bonus: (row.bonus as string | null) ?? null,
    reportingManager: row.reportingManager as string,
    customTerms: (row.customTerms as string | null) ?? null,
    letterHtml: (row.letterHtml as string) ?? "",
    letterHash: (row.letterHash as string) ?? "",
    status: row.status as OfferStatus,
    sentAt: dn(row.sentAt as string | null),
    signedAt: dn(row.signedAt as string | null),
    declinedAt: dn(row.declinedAt as string | null),
    createdAt: d(row.createdAt as string),
    updatedAt: d(row.updatedAt as string),
    ...(row.application
      ? { application: parseApplicationRow(row.application as Record<string, unknown>) }
      : {}),
    ...(row.signature !== undefined
      ? {
          signature: row.signature
            ? parseOfferSignatureRow(row.signature as Record<string, unknown>)
            : null,
        }
      : {}),
  };
}

export function parseOfferSignatureRow(row: Record<string, unknown>): OfferSignature {
  return {
    id: row.id as string,
    offerId: row.offerId as string,
    candidateId: row.candidateId as string,
    signatureBase64: row.signatureBase64 as string,
    ipAddress: row.ipAddress as string,
    userAgent: row.userAgent as string,
    signedAt: d(row.signedAt as string),
    signatureHash: row.signatureHash as string,
    createdAt: d(row.createdAt as string),
  };
}

export function parseInterviewRow(row: Record<string, unknown>): Interview {
  return {
    id: row.id as string,
    applicationId: row.applicationId as string,
    slotId: row.slotId as string,
    firefliesMeetingId: (row.firefliesMeetingId as string | null) ?? null,
    meetingUrl: (row.meetingUrl as string | null) ?? null,
    transcriptRaw: row.transcriptRaw ?? null,
    transcriptText: (row.transcriptText as string | null) ?? null,
    transcriptSummary: (row.transcriptSummary as string | null) ?? null,
    aiScorecard: row.aiScorecard ?? null,
    status: row.status as InterviewStatus,
    scheduledAt: d(row.scheduledAt as string),
    completedAt: dn(row.completedAt as string | null),
    transcriptFetchedAt: dn(row.transcriptFetchedAt as string | null),
    createdAt: d(row.createdAt as string),
    updatedAt: d(row.updatedAt as string),
    ...(row.application
      ? { application: row.application as { id: string; candidateName: string } }
      : {}),
  };
}
