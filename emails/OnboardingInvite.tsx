/** @jsxImportSource react */
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
  render,
} from "@react-email/components";

export interface OnboardingInviteProps {
  candidateName: string;
  role: string;
  startDate: string;
  slackInviteUrl: string;
  supportEmail?: string;
}

/** Async wrapper mirroring the `renderInterviewInviteEmail` pattern in `emails/InterviewInvite.tsx`. */
export async function renderOnboardingInviteEmail(
  props: OnboardingInviteProps,
): Promise<string> {
  return render(OnboardingInvite(props));
}

export function OnboardingInvite({
  candidateName,
  role,
  startDate,
  slackInviteUrl,
  supportEmail = "hiring@niural.com",
}: OnboardingInviteProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Niural — join us on Slack</Preview>
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#f6f7f9",
          padding: "24px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: 560,
          }}
        >
          <Heading as="h1" style={{ fontSize: 20, margin: 0 }}>
            Welcome to Niural, {candidateName}!
          </Heading>
          <Text>
            Your offer is signed. Here is the next step: joining the team on Slack.
          </Text>

          <Section
            style={{
              backgroundColor: "#f1f5f9",
              padding: 16,
              borderRadius: 6,
            }}
          >
            <Text style={{ margin: 0 }}>
              <strong>Role:</strong> {role}
            </Text>
            <Text style={{ margin: 0 }}>
              <strong>Start date:</strong> {startDate}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", padding: "24px 0" }}>
            <Button
              href={slackInviteUrl}
              style={{
                backgroundColor: "#111827",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Join our Slack workspace
            </Button>
          </Section>

          <Text style={{ fontSize: 13, color: "#475569" }}>
            Once you join, our onboarding bot will send you a welcome message and
            your manager will reach out shortly.
          </Text>

          <Hr />
          <Text style={{ fontSize: 12, color: "#64748b" }}>
            Questions? Reply to this email or reach us at{" "}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OnboardingInvite;
