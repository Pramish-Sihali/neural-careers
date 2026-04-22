interface Props {
  candidateName: string;
  jobTitle: string;
  signingUrl: string;
  customNote?: string | null;
}

export function renderOfferLetterEmail(props: Props): string {
  const noteBlock = props.customNote
    ? `<div style="background:#f9fafb;border-left:3px solid #2563eb;padding:12px 16px;margin:20px 0;border-radius:4px;">
         <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">${props.customNote}</p>
       </div>`
    : "";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;">
  <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Your offer from Niural</h2>
  <p style="color:#374151;font-size:15px;line-height:1.6;">Hi ${props.candidateName},</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;">
    We're delighted to extend you an offer to join Niural as <strong>${props.jobTitle}</strong>.
    Please review the full letter and sign it using the secure link below.
  </p>
  ${noteBlock}
  <div style="text-align:center;margin:32px 0;">
    <a href="${props.signingUrl}"
       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;">
      Review &amp; sign offer →
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;line-height:1.6;">
    This link is unique to you and expires in 7 days. If you have any questions before signing,
    reply to this email and a member of the hiring team will respond.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 24px;"/>
  <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
    Niural automated hiring system — please do not reply directly to this email.
  </p>
</div>`;
}
