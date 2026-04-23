import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleTeamJoin } from "@/lib/services/onboardingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPLAY_WINDOW_SECONDS = 60 * 5;

function isValidSignature(
  rawBody: string,
  timestamp: string,
  signatureHeader: string
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET ?? "";
  if (!secret) return false;
  const basestring = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${crypto
    .createHmac("sha256", secret)
    .update(basestring)
    .digest("hex")}`;
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isFreshTimestamp(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - ts) <= REPLAY_WINDOW_SECONDS;
}

type SlackEventEnvelope =
  | { type: "url_verification"; challenge: string }
  | {
      type: "event_callback";
      event?: {
        type?: string;
        user?: {
          id?: string;
          profile?: { email?: string; real_name?: string };
        };
      };
    }
  | { type: string };

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-slack-signature") ?? "";
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";

  if (!signatureHeader || !timestamp) {
    return NextResponse.json(
      { error: "Missing Slack signature headers" },
      { status: 401 }
    );
  }

  if (!isFreshTimestamp(timestamp)) {
    return NextResponse.json(
      { error: "Slack request timestamp outside replay window" },
      { status: 401 }
    );
  }

  if (!isValidSignature(rawBody, timestamp, signatureHeader)) {
    return NextResponse.json(
      { error: "Invalid Slack signature" },
      { status: 401 }
    );
  }

  let body: SlackEventEnvelope;
  try {
    body = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Slack URL verification handshake — must echo back the challenge.
  if (body.type === "url_verification") {
    const challenge = (body as { challenge?: string }).challenge ?? "";
    return NextResponse.json({ challenge });
  }

  if (body.type === "event_callback") {
    const event = (body as { event?: { type?: string } }).event;
    if (event?.type === "team_join") {
      const user = (event as {
        user?: { id?: string; profile?: { email?: string; real_name?: string } };
      }).user;
      const userId = user?.id;
      const email = user?.profile?.email;
      const realName = user?.profile?.real_name ?? "";

      if (userId && email) {
        try {
          const res = await handleTeamJoin({
            slackUserId: userId,
            email,
            realName,
          });
          console.log("[slack webhook] team_join handled", { email, ...res });
        } catch (err) {
          // Swallow — 200 avoids Slack retry storms. Idempotency on
          // welcomeDmSentAt protects duplicate processing on retry if we
          // eventually return a non-200.
          console.error("[slack webhook] team_join handler error", err);
        }
      } else {
        console.warn("[slack webhook] team_join missing user id or email");
      }
    }
  }

  return new Response(null, { status: 200 });
}
