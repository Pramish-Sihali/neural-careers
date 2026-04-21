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
}

interface Props {
  candidateName: string;
  jobTitle: string;
  slots: Slot[];
  scheduleUrl: string;
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

export default function InterviewInvite({ candidateName, jobTitle, slots, scheduleUrl }: Props) {
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
            Please choose an interview time that works for you.
          </Text>

          <Section style={slotSection}>
            <Text style={slotLabel}>Available time slots</Text>
            {slots.map((slot) => (
              <Text key={slot.id} style={slotRow}>
                • {fmtSlot(slot.startTime, slot.endTime)}
              </Text>
            ))}
          </Section>

          <Button href={scheduleUrl} style={button}>
            Choose your interview time →
          </Button>

          <Text style={note}>
            This link expires in 48 hours. If none of these times work, please
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
    { id: "1", startTime: "2026-04-28T09:00:00Z", endTime: "2026-04-28T10:00:00Z" },
    { id: "2", startTime: "2026-04-28T11:00:00Z", endTime: "2026-04-28T12:00:00Z" },
    { id: "3", startTime: "2026-04-29T14:00:00Z", endTime: "2026-04-29T15:00:00Z" },
  ],
  scheduleUrl: "http://localhost:3000/schedule/mock-token",
} satisfies Props;

/** Plain HTML version for Resend (non-React-Email path) */
export function renderInterviewInviteEmail(props: Props): string {
  const slotRows = props.slots
    .map(
      (s) =>
        `<p style="margin:4px 0;color:#374151;">• ${fmtSlot(s.startTime, s.endTime)}</p>`
    )
    .join("");

  return `
<div style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="margin:0 0 16px;color:#111827;">You've been shortlisted!</h2>
  <p style="color:#374151;">Hi ${props.candidateName},</p>
  <p style="color:#374151;">Congratulations — you've been shortlisted for <strong>${props.jobTitle}</strong> at Niural. Please choose an interview time that works for you.</p>
  <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:24px 0;">
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Available time slots</p>
    ${slotRows}
  </div>
  <a href="${props.scheduleUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">Choose your interview time →</a>
  <p style="margin-top:24px;font-size:13px;color:#6b7280;">This link expires in 48 hours.</p>
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
const slotRow: React.CSSProperties = { color: "#374151", fontSize: "14px", margin: "4px 0" };
const button: React.CSSProperties = { background: "#2563eb", color: "#ffffff", padding: "12px 24px", borderRadius: "6px", fontWeight: "600", fontSize: "14px", textDecoration: "none" };
const note: React.CSSProperties = { color: "#6b7280", fontSize: "13px", margin: "24px 0 0" };
const hr: React.CSSProperties = { borderColor: "#e5e7eb", margin: "32px 0 24px" };
const footer: React.CSSProperties = { color: "#9ca3af", fontSize: "12px", lineHeight: "1.5", margin: "0" };
