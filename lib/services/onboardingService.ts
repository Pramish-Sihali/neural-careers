import { supabase } from "@/lib/supabase";
import {
  parseApplicationRow,
  parseSlackOnboardingRow,
  EventType,
  ApplicationStatus,
  type SlackOnboarding,
} from "@/lib/types/database";
import { getEmailService } from "@/lib/integrations/email";
import { getSlackService } from "@/lib/integrations/slack";
import { renderOnboardingInviteEmail } from "@/emails/OnboardingInvite";
import { generateWelcomeMessage } from "@/lib/ai/prompts/generateWelcomeMessage";

// --- Pure helper (unit-testable) -------------------------------------------

export async function buildInvitePayload(input: {
  candidateName:   string;
  role:            string;
  startDateIso:    string;
  slackInviteUrl:  string;
}): Promise<{ subject: string; html: string }> {
  const startDate = new Date(input.startDateIso).toLocaleDateString("en-US",
    { year: "numeric", month: "long", day: "numeric" });
  const html = await renderOnboardingInviteEmail({
    candidateName: input.candidateName,
    role:          input.role,
    startDate,
    slackInviteUrl: input.slackInviteUrl,
  });
  return { subject: "Welcome to Niural — join us on Slack", html };
}

const SLACK_INVITE_URL = () => process.env.SLACK_INVITE_LINK ?? "";

/**
 * Fetch or create the SlackOnboarding row for an application.
 */
async function getOrCreateSlackOnboarding(applicationId: string): Promise<SlackOnboarding> {
  const { data: existing } = await supabase
    .from("slack_onboardings")
    .select("*")
    .eq("applicationId", applicationId)
    .maybeSingle();

  if (existing) return parseSlackOnboardingRow(existing as Record<string, unknown>);

  const nowIso = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("slack_onboardings")
    .insert({
      id:            crypto.randomUUID(),
      applicationId,
      createdAt:     nowIso,
      updatedAt:     nowIso,
    })
    .select("*")
    .single();
  if (error || !created) throw new Error(`Failed to create slack_onboardings row: ${error?.message}`);
  return parseSlackOnboardingRow(created as Record<string, unknown>);
}

/**
 * Send the Slack invite email to the candidate and mark inviteEmailSentAt.
 * Idempotent by default — pass { force: true } to re-send (admin resend).
 *
 * Called by:
 *  - Admin "Resend Slack invite" button (manual, with force: true)
 *  - Phase 05 offer-signed handler (to be wired after Phase 5 lands — NOT in scope)
 */
export async function sendOnboardingInvite(
  applicationId: string,
  options: { force?: boolean } = {}
): Promise<{ sent: boolean; alreadySent?: boolean; reason?: string }> {
  const { data: appRow, error: appErr } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", applicationId)
    .single();
  if (appErr || !appRow) return { sent: false, reason: "application_not_found" };
  const app = parseApplicationRow(appRow as Record<string, unknown>);

  const inviteUrl = SLACK_INVITE_URL();
  if (!inviteUrl) return { sent: false, reason: "SLACK_INVITE_LINK_missing" };

  const onboarding = await getOrCreateSlackOnboarding(applicationId);
  if (onboarding.inviteEmailSentAt && !options.force) {
    return { sent: false, alreadySent: true };
  }

  // For demo: start date is not tracked yet (Phase 05's offers table will hold it).
  // Use today + 14 days as a placeholder until Phase 05 lands.
  const startDateIso = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const { subject, html } = await buildInvitePayload({
    candidateName:  app.candidateName,
    role:           app.job?.title ?? "your new role",
    startDateIso,
    slackInviteUrl: inviteUrl,
  });

  await getEmailService().send({ to: app.candidateEmail, subject, html });

  const nowIso = new Date().toISOString();
  await supabase
    .from("slack_onboardings")
    .update({ inviteEmailSentAt: nowIso, updatedAt: nowIso })
    .eq("id", onboarding.id);

  // events_log — no updatedAt column (matches calendarService.ts:150 pattern)
  await supabase.from("events_log").insert({
    id:             crypto.randomUUID(),
    applicationId,
    eventType:      EventType.SLACK_INVITED,
    payload:        { inviteUrl, force: options.force ?? false },
    idempotencyKey: `slack-invite-${applicationId}-${nowIso}`,
    createdAt:      nowIso,
  });

  return { sent: true };
}

/**
 * Handle a team_join event. Called by the Bolt listener.
 * Idempotent via SlackOnboarding.welcomeDmSentAt.
 */
export async function handleTeamJoin(params: {
  slackUserId: string;
  email:       string;
  realName:    string;
}): Promise<{ welcomed: boolean; reason?: string }> {
  // Look up application by candidate email; join job + enrichment for the prompt
  const { data: appRow } = await supabase
    .from("applications")
    .select("*, job:jobs(*), enrichment:candidate_enrichments(*)")
    .eq("candidateEmail", params.email)
    .maybeSingle();

  if (!appRow) return { welcomed: false, reason: "no_matching_application" };
  const app = parseApplicationRow(appRow as Record<string, unknown>);

  const onboarding = await getOrCreateSlackOnboarding(app.id);
  if (onboarding.welcomeDmSentAt) return { welcomed: false, reason: "already_welcomed" };

  // Generate personalized welcome message
  const welcome = await generateWelcomeMessage({
    candidateName:  app.candidateName.split(" ")[0],
    role:           app.job?.title ?? "your new role",
    team:           app.job?.team ?? "the team",
    startDate:      new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    candidateBrief: app.enrichment?.candidateBrief,
    resourceLinks: [
      { label: "Onboarding checklist", url: "https://example.com/onboarding" },
      { label: "Engineering handbook",  url: "https://example.com/handbook" },
    ],
  });

  const slack = getSlackService();
  const dm = await slack.sendDM(params.slackUserId, welcome.message);
  if (!dm.ok) return { welcomed: false, reason: dm.reason ?? "dm_failed" };

  const nowIso = new Date().toISOString();

  // HR notification (best-effort)
  let hrNotifiedAt: string | null = null;
  const hrChannel = process.env.SLACK_HR_CHANNEL_ID;
  if (hrChannel) {
    const res = await slack.postChannelMessage(
      hrChannel,
      `:white_check_mark: *${params.realName}* (${params.email}) has joined Slack and been welcomed.`
    ).catch((e) => { console.error("HR notification failed", e); return { ok: false } as const; });
    if (res.ok) hrNotifiedAt = nowIso;
  }

  // Update slack_onboardings with join + welcome timestamps
  await supabase
    .from("slack_onboardings")
    .update({
      joinedAt:        onboarding.joinedAt?.toISOString() ?? nowIso,
      welcomeDmSentAt: nowIso,
      slackUserId:     params.slackUserId,
      hrNotifiedAt,
      updatedAt:       nowIso,
    })
    .eq("id", onboarding.id);

  // Transition application status
  await supabase
    .from("applications")
    .update({
      status:    ApplicationStatus.ONBOARDED,
      updatedAt: nowIso,
    })
    .eq("id", app.id);

  await supabase.from("events_log").insert({
    id:             crypto.randomUUID(),
    applicationId:  app.id,
    eventType:      EventType.SLACK_JOINED,
    payload:        { slackUserId: params.slackUserId, realName: params.realName },
    idempotencyKey: `slack-joined-${app.id}`,
    createdAt:      nowIso,
  });

  return { welcomed: true };
}
