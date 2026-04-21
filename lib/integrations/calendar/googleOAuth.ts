import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { encryptTokens, decryptTokens } from "./tokenCrypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
  "email",
  "profile",
];

let _client: OAuth2Client | null = null;

function buildClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getOAuth2Client(): OAuth2Client {
  if (!_client) _client = buildClient();
  return _client;
}

export function getAuthUrl(): string {
  return buildClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",    // always return refresh_token
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ email: string }> {
  const client = buildClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Fetch the authenticated user's email
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email;
  if (!email) throw new Error("Could not determine interviewer email from Google");

  // Persist encrypted tokens — upsert so re-auth overwrites cleanly
  await prisma.interviewerCredentials.upsert({
    where: { interviewerEmail: email },
    create: {
      interviewerEmail: email,
      encryptedTokens: encryptTokens(tokens),
    },
    update: {
      // Merge: only overwrite refresh_token if Google returned a new one
      encryptedTokens: encryptTokens(tokens),
    },
  });

  return { email };
}

export async function getAuthorizedClient(
  interviewerEmail: string
): Promise<OAuth2Client> {
  const creds = await prisma.interviewerCredentials.findUnique({
    where: { interviewerEmail },
  });
  if (!creds) {
    throw new Error(
      `No credentials found for ${interviewerEmail}. Visit /api/auth/google to connect the account.`
    );
  }

  const client = buildClient();
  const tokens = decryptTokens(creds.encryptedTokens);
  client.setCredentials(tokens);

  // Persist any refreshed tokens automatically
  client.on("tokens", async (newTokens) => {
    const merged: Record<string, unknown> = { ...tokens, ...newTokens };
    // refresh_token is only present on first auth — never overwrite with undefined
    if (!newTokens.refresh_token && tokens.refresh_token) {
      merged.refresh_token = tokens.refresh_token;
    }
    await prisma.interviewerCredentials.update({
      where: { interviewerEmail },
      data: { encryptedTokens: encryptTokens(merged) },
    });
  });

  return client;
}
