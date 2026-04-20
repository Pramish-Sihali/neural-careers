-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'SCREENED', 'SHORTLISTED', 'INTERVIEWING', 'POST_INTERVIEW', 'OFFER_SENT', 'OFFER_SIGNED', 'ONBOARDED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'DECLINED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('APPLICATION_SUBMITTED', 'APPLICATION_SCREENED', 'CANDIDATE_SHORTLISTED', 'CANDIDATE_REJECTED', 'SLOTS_OFFERED', 'SLOT_CONFIRMED', 'INTERVIEW_COMPLETED', 'OFFER_GENERATED', 'OFFER_SENT', 'OFFER_SIGNED', 'SLACK_INVITED', 'SLACK_JOINED', 'NUDGE_SENT');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "resumeUrl" TEXT NOT NULL,
    "resumeText" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "fitScore" INTEGER,
    "screeningSummary" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "screenedAt" TIMESTAMP(3),
    "shortlistedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_enrichments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "linkedinSummary" TEXT,
    "githubUsername" TEXT,
    "githubDigest" JSONB,
    "twitterSummary" TEXT,
    "candidateBrief" TEXT NOT NULL,
    "discrepancies" JSONB NOT NULL DEFAULT '[]',
    "enrichedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_enrichments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_slots" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewerEmail" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'HELD',
    "googleEventId" TEXT,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "firefliesMeetingId" TEXT,
    "transcriptRaw" JSONB,
    "transcriptText" TEXT,
    "transcriptSummary" TEXT,
    "aiScorecard" JSONB,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "transcriptFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "compensationStructure" TEXT NOT NULL,
    "equity" TEXT,
    "bonus" TEXT,
    "reportingManager" TEXT NOT NULL,
    "customTerms" TEXT,
    "letterHtml" TEXT NOT NULL,
    "letterHash" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_signatures" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "signatureBase64" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_onboardings" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "inviteEmailSentAt" TIMESTAMP(3),
    "slackUserId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "welcomeDmSentAt" TIMESTAMP(3),
    "hrNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events_log" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "eventType" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_nudges" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "nudgeType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_jobId_idx" ON "applications"("jobId");

-- CreateIndex
CREATE INDEX "applications_fitScore_idx" ON "applications"("fitScore");

-- CreateIndex
CREATE UNIQUE INDEX "applications_candidateEmail_jobId_key" ON "applications"("candidateEmail", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_enrichments_applicationId_key" ON "candidate_enrichments"("applicationId");

-- CreateIndex
CREATE INDEX "interview_slots_applicationId_idx" ON "interview_slots"("applicationId");

-- CreateIndex
CREATE INDEX "interview_slots_status_idx" ON "interview_slots"("status");

-- CreateIndex
CREATE INDEX "interview_slots_holdExpiresAt_idx" ON "interview_slots"("holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_applicationId_key" ON "interviews"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_slotId_key" ON "interviews"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_applicationId_key" ON "offers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_signatures_offerId_key" ON "offer_signatures"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_onboardings_applicationId_key" ON "slack_onboardings"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "events_log_idempotencyKey_key" ON "events_log"("idempotencyKey");

-- CreateIndex
CREATE INDEX "events_log_applicationId_idx" ON "events_log"("applicationId");

-- CreateIndex
CREATE INDEX "events_log_eventType_idx" ON "events_log"("eventType");

-- CreateIndex
CREATE INDEX "events_log_createdAt_idx" ON "events_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_nudges_applicationId_nudgeType_key" ON "scheduled_nudges"("applicationId", "nudgeType");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_enrichments" ADD CONSTRAINT "candidate_enrichments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "interview_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_signatures" ADD CONSTRAINT "offer_signatures_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_onboardings" ADD CONSTRAINT "slack_onboardings_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events_log" ADD CONSTRAINT "events_log_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_nudges" ADD CONSTRAINT "scheduled_nudges_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
