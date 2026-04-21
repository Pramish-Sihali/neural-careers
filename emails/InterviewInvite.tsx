import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  confirmUrl: string;
}

interface Props {
  candidateName: string;
  jobTitle: string;
  slots: Slot[];
}

function fmtSlot(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${startTime} – ${endTime}`;
}

export default function InterviewInvite({ candidateName, jobTitle, slots }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Choose your interview time — {jobTitle}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>You&apos;ve been shortlisted!</Heading>
          <Text style={text}>Hi {candidateName},</Text>
          <Text style={text}>
            Congratulations — you&apos;ve been shortlisted for <strong>{jobTitle}</strong> at Niural.
            Click the button next to the time that works best for you to confirm instantly.
          </Text>

          <Section style={slotSection}>
            <Text style={slotLabel}>Available time slots</Text>
            {slots.map((slot) => (
              <Section key={slot.id} style={slotRow}>
                <Text style={slotText}>• {fmtSlot(slot.startTime, slot.endTime)}</Text>
                <Button href={slot.confirmUrl} style={button}>
                  Confirm this slot →
                </Button>
              </Section>
            ))}
          </Section>

          <Text style={note}>
            Each button confirms that specific slot immediately — no extra steps.
            Links expire in 48 hours. If none of these times work, please
            reply to this email and we&apos;ll find an alternative.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Niural automated hiring system — please do not reply directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

InterviewInvite.PreviewProps = {
  candidateName: "Alex Johnson",
  jobTitle: "Senior Software Engineer",
  slots: [
    {
      id: "1",
      startTime: "2026-04-28T09:00:00Z",
      endTime: "2026-04-28T10:00:00Z",
      confirmUrl: "http://localhost:3000/api/schedule/confirm?token=mock-token&slotId=1",
    },
    {
      id: "2",
      startTime: "2026-04-28T11:00:00Z",
      endTime: "2026-04-28T12:00:00Z",
      confirmUrl: "http://localhost:3000/api/schedule/confirm?token=mock-token&slotId=2",
    },
    {
      id: "3",
      startTime: "2026-04-29T14:00:00Z",
      endTime: "2026-04-29T15:00:00Z",
      confirmUrl: "http://localhost:3000/api/schedule/confirm?token=mock-token&slotId=3",
    },
  ],
} satisfies Props;

/** Plain HTML version for Resend (non-React-Email path) */
export function renderInterviewInviteEmail(props: Props): string {
  const slotRows = props.slots
    .map(
      (s) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;color:#374151;font-size:14px;">• ${fmtSlot(s.startTime, s.endTime)}</p>
          <a href="${s.confirmUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;white-space:nowrap;margin-left:16px;">Confirm this slot →</a>
        </div>`
    )
    .join("");

  return `
<div style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="margin:0 0 16px;color:#111827;">You've been shortlisted!</h2>
  <p style="color:#374151;">Hi ${props.candidateName},</p>
  <p style="color:#374151;">Congratulations — you've been shortlisted for <strong>${props.jobTitle}</strong> at Niural. Click the button next to the time that works best for you to confirm instantly.</p>
  <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:24px 0;">
    <p style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Available time slots</p>
    ${slotRows}
  </div>
  <p style="margin-top:24px;font-size:13px;color:#6b7280;">Each button confirms that specific slot immediately — no extra steps. Links expire in 48 hours.</p>
  <hr style="border-color:#e5e7eb;margin:32px 0 24px;"/>
  <p style="font-size:12px;color:#9ca3af;">Niural automated hiring system — please do not reply to this email.</p>
</div>`;
}

const body: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px",
  maxWidth: "560px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
};
const h1: React.CSSProperties = { color: "#111827", fontSize: "24px", fontWeight: "700", margin: "0 0 24px" };
const text: React.CSSProperties = { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px" };
const slotSection: React.CSSProperties = { background: "#f3f4f6", borderRadius: "6px", padding: "16px", margin: "24px 0" };
const slotLabel: React.CSSProperties = { color: "#6b7280", fontSize: "12px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 8px" };
const slotRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" };
const slotText: React.CSSProperties = { color: "#374151", fontSize: "14px", margin: "0" };
const button: React.CSSProperties = { background: "#2563eb", color: "#ffffff", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", textDecoration: "none", whiteSpace: "nowrap", marginLeft: "16px" };
const note: React.CSSProperties = { color: "#6b7280", fontSize: "13px", margin: "24px 0 0" };
const hr: React.CSSProperties = { borderColor: "#e5e7eb", margin: "32px 0 24px" };
const footer: React.CSSProperties = { color: "#9ca3af", fontSize: "12px", lineHeight: "1.5", margin: "0" };
