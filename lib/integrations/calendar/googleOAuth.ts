import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { supabase } from "@/lib/supabase";
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
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ email: string }> {
  const client = buildClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email;
  if (!email) throw new Error("Could not determine interviewer email from Google");

  const encrypted = encryptTokens(tokens);
  const nowIso = new Date().toISOString();

  // Check if record exists, then update or insert
  const { data: existing } = await supabase
    .from("interviewer_credentials")
    .select("id")
    .eq("interviewerEmail", email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("interviewer_credentials")
      .update({ encryptedTokens: encrypted, updatedAt: nowIso })
      .eq("interviewerEmail", email);
  } else {
    await supabase.from("interviewer_credentials").insert({
      id: crypto.randomUUID(),
      interviewerEmail: email,
      encryptedTokens: encrypted,
      isConfigured: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return { email };
}

export async function getAuthorizedClient(
  interviewerEmail: string
): Promise<OAuth2Client> {
  const { data, error } = await supabase
    .from("interviewer_credentials")
    .select("encryptedTokens")
    .eq("interviewerEmail", interviewerEmail)
    .single();

  if (error || !data) {
    throw new Error(
      `No credentials found for ${interviewerEmail}. Visit /api/auth/google to connect the account.`
    );
  }

  const creds = data as { encryptedTokens: string };
  const client = buildClient();
  const tokens = decryptTokens(creds.encryptedTokens);
  client.setCredentials(tokens);

  client.on("tokens", async (newTokens) => {
    const merged: Record<string, unknown> = { ...tokens, ...newTokens };
    if (!newTokens.refresh_token && tokens.refresh_token) {
      merged.refresh_token = tokens.refresh_token;
    }
    await supabase
      .from("interviewer_credentials")
      .update({ encryptedTokens: encryptTokens(merged), updatedAt: new Date().toISOString() })
      .eq("interviewerEmail", interviewerEmail);
  });

  return client;
}
