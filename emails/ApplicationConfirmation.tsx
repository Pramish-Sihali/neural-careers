import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Props {
  candidateName: string;
  jobTitle: string;
  applicationId: string;
}

export default function ApplicationConfirmation({
  candidateName,
  jobTitle,
  applicationId,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Application received — {jobTitle}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Application received</Heading>
          <Text style={text}>Hi {candidateName},</Text>
          <Text style={text}>
            Thanks for applying for <strong>{jobTitle}</strong>. We&apos;ve
            received your application and our team will review it shortly.
          </Text>
          <Section style={infoBox}>
            <Text style={infoLabel}>Application ID</Text>
            <Text style={infoValue}>{applicationId}</Text>
          </Section>
          <Text style={text}>
            We&apos;ll be in touch if your profile is a strong match for the
            role. In the meantime, feel free to reach out if you have any
            questions.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            This email was sent by Niural&apos;s automated hiring system. Please
            do not reply directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

ApplicationConfirmation.PreviewProps = {
  candidateName: "Alex Johnson",
  jobTitle: "Senior Software Engineer",
  applicationId: "clx1234567890abcdef",
} satisfies Props;

const body: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px",
  maxWidth: "560px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
};

const h1: React.CSSProperties = {
  color: "#111827",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 24px",
};

const text: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const infoBox: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  padding: "16px",
  margin: "24px 0",
};

const infoLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  margin: "0 0 4px",
};

const infoValue: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontFamily: "monospace",
  margin: "0",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "32px 0 24px",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0",
};
