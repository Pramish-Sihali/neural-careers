"use client";
import { useState } from "react";

export interface SlackStatusProps {
  applicationId:     string;
  // All props below map 1:1 to slack_onboardings columns, passed as ISO strings.
  // If no slack_onboardings row exists yet, pass nulls for all timestamps.
  inviteEmailSentAt: string | null;
  joinedAt:          string | null;
  welcomeDmSentAt:   string | null;
  hrNotifiedAt:      string | null;
  slackUserId:       string | null;
}

export function SlackStatus(props: SlackStatusProps) {
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setBusy(true); setMessage(null);
    const res = await fetch(
      `/api/admin/applications/${props.applicationId}/resend-slack-invite`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ""}` },
      }
    );
    const body = await res.json();
    setMessage(res.ok
      ? (body.alreadySent ? "Invite already sent previously." : "Invite sent.")
      : (body.error ?? "Failed"));
    setBusy(false);
  }

  return (
    <section className="rounded-lg border p-4 space-y-2">
      <h3 className="font-semibold">Slack onboarding</h3>
      <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Invite sent</dt>
        <dd>{fmt(props.inviteEmailSentAt)}</dd>
        <dt className="text-muted-foreground">Joined workspace</dt>
        <dd>{fmt(props.joinedAt)}</dd>
        <dt className="text-muted-foreground">Welcomed by bot</dt>
        <dd>{fmt(props.welcomeDmSentAt)}</dd>
        <dt className="text-muted-foreground">HR notified</dt>
        <dd>{fmt(props.hrNotifiedAt)}</dd>
        <dt className="text-muted-foreground">Slack user ID</dt>
        <dd>{props.slackUserId ?? "—"}</dd>
      </dl>
      <button
        onClick={resend}
        disabled={busy}
        className="rounded bg-slate-900 text-white text-sm px-3 py-1.5 disabled:opacity-50"
      >
        {busy ? "Sending…" : (props.inviteEmailSentAt ? "Resend invite" : "Send Slack invite")}
      </button>
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </section>
  );
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}
