interface Props {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  signedAt: Date;
  adminOfferUrl: string;
}

function fmt(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

export function renderOfferSignedEmail(props: Props): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;">
  <div style="font-size:40px;margin-bottom:12px;">✅</div>
  <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Offer signed</h2>
  <p style="color:#374151;font-size:15px;line-height:1.6;">
    <strong>${props.candidateName}</strong> (${props.candidateEmail}) has signed their offer for
    <strong>${props.jobTitle}</strong>.
  </p>
  <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:20px 0;">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">
      Signed at
    </p>
    <p style="margin:0;font-size:15px;color:#111827;font-weight:500;">${fmt(props.signedAt)}</p>
  </div>
  <p style="color:#374151;font-size:15px;line-height:1.6;">
    Slack onboarding will be triggered automatically. You can view the signed offer record
    (including signature, IP, and user-agent) in the admin dashboard.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${props.adminOfferUrl}"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:600;font-size:14px;">
      Open offer record →
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 24px;"/>
  <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
    Niural automated hiring system.
  </p>
</div>`;
}
