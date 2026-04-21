# Google Calendar Integration — Architecture Reference

Research document for Phase 03 (Calendar Orchestration).  
Written before implementation — use as the authoritative guide for building both
`MockCalendarService` and `GoogleCalendarService`.

---

## Decision: OAuth2 User Credentials (not Service Account)

For 1–5 interviewers, OAuth2 user credentials are the correct choice.

| Aspect | OAuth2 User | Service Account |
|--------|-------------|-----------------|
| Interview invites appear from | Real interviewer's email ✓ | `service-account@...` bot |
| Setup per interviewer | OAuth flow once | Domain-wide delegation (GSuite admin) |
| Token refresh | Built-in `oauth2Client.on('tokens')` | No refresh needed (private key) |
| Recommended for this project | **Yes** | No |

---

## Environment Variables

```bash
# Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# 32-byte hex key for AES-256-GCM encryption of stored refresh tokens
# Generate once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GOOGLE_TOKENS_ENCRYPTION_KEY=<32-byte-hex>

# IANA timezone for slot generation
GOOGLE_CALENDAR_TIMEZONE=America/New_York

# Set true in dev to bypass real Google API calls
USE_MOCK_CALENDAR=true
```

---

## Required OAuth Scopes

```
https://www.googleapis.com/auth/calendar.events   — create / read / delete events
https://www.googleapis.com/auth/calendar           — freebusy query
```

---

## Token Storage

Add to `prisma/schema.prisma` before implementing the real service:

```prisma
model InterviewerCredentials {
  id               String   @id @default(cuid())
  interviewerEmail String   @unique
  // AES-256-GCM encrypted JSON: { access_token?, refresh_token, expiry_date? }
  encryptedTokens  String   @db.Text
  isConfigured     Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("interviewer_credentials")
}
```

### Encryption helpers (`lib/integrations/calendar/tokenCrypto.ts`)

```ts
import crypto from "crypto";

const KEY = Buffer.from(process.env.GOOGLE_TOKENS_ENCRYPTION_KEY!, "hex");

export function encryptTokens(tokens: object): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  let enc = cipher.update(JSON.stringify(tokens), "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${enc}`;
}

export function decryptTokens(stored: string): object {
  const [iv, tag, ciphertext] = stored.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  let dec = decipher.update(ciphertext, "hex", "utf8");
  dec += decipher.final("utf8");
  return JSON.parse(dec);
}
```

---

## OAuth2 Client Singleton (`lib/integrations/calendar/googleOAuth.ts`)

```ts
import { google } from "googleapis";
import type { OAuth2Client } from "googleapis-common";
import { prisma } from "@/lib/prisma";
import { decryptTokens, encryptTokens } from "./tokenCrypto";

let _client: OAuth2Client | null = null;

export function getOAuth2Client(): OAuth2Client {
  if (!_client) {
    _client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    // Persist refreshed tokens automatically
    _client.on("tokens", async (tokens) => {
      // tokens.refresh_token is only present on first auth — merge, don't overwrite
      // Store against the currently-configured interviewer email
    });
  }
  return _client;
}

export async function getAuthorizedClient(interviewerEmail: string): Promise<OAuth2Client> {
  const client = getOAuth2Client();
  const creds = await prisma.interviewerCredentials.findUniqueOrThrow({
    where: { interviewerEmail },
  });
  client.setCredentials(decryptTokens(creds.encryptedTokens) as any);
  return client;
}

export function getAuthUrl(): string {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",      // Required to receive a refresh_token
    prompt: "consent",           // Force consent screen so refresh_token is always returned
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar",
    ],
  });
}
```

---

## ICalendarService Interface (`lib/integrations/calendar/ICalendarService.ts`)

```ts
export interface AvailableSlot {
  start: Date;
  end: Date;
}

export interface CalendarEvent {
  googleEventId: string;
  meetLink?: string;
}

export interface ICalendarService {
  /** Return free 1-hour (default) slots for an interviewer over a date range. */
  getAvailableSlots(
    interviewerEmail: string,
    dateStart: Date,
    dateEnd: Date,
    slotDurationMinutes?: number
  ): Promise<AvailableSlot[]>;

  /** Create a tentative hold event. Returns Google event ID + Meet link. */
  holdSlot(
    interviewerEmail: string,
    candidateName: string,
    candidateEmail: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent>;

  /** Delete a hold or confirmed event; sends cancellation emails. */
  releaseSlot(
    interviewerEmail: string,
    googleEventId: string
  ): Promise<void>;
}
```

---

## Availability Checking: freebusy.query

```ts
const response = await calendar.freebusy.query({
  requestBody: {
    timeMin: dateStart.toISOString(),
    timeMax: dateEnd.toISOString(),
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "UTC",
    items: [{ id: "primary" }],
  },
});

const busy = response.data.calendars?.primary?.busy ?? [];
// busy = [{ start: "2026-04-21T10:00:00Z", end: "2026-04-21T11:00:00Z" }, ...]

// Filter candidate slots against busy periods:
const available = candidateSlots.filter(
  (slot) =>
    !busy.some(
      (b) => new Date(b.start!) < slot.end && new Date(b.end!) > slot.start
    )
);
```

---

## Event Creation: events.insert

```ts
const response = await calendar.events.insert({
  calendarId: "primary",
  conferenceDataVersion: 1,          // Required for Meet link generation
  sendUpdates: "all",                // Email invites to all attendees
  requestBody: {
    summary: `Interview: ${candidateName}`,
    start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
    end:   { dateTime: endTime.toISOString(),   timeZone: "UTC" },
    attendees: [
      { email: interviewerEmail },
      { email: candidateEmail, displayName: candidateName, responseStatus: "needsAction" },
    ],
    conferenceData: {
      createRequest: {
        requestId: uuid(),                    // Idempotency key — store this
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    guestsCanModify: false,
    guestsCanInviteOthers: false,
  },
});

const googleEventId = response.data.id!;
const meetLink = response.data.conferenceData
  ?.entryPoints
  ?.find((ep) => ep.entryPointType === "video")
  ?.uri;
```

**Critical:**
- `conferenceDataVersion: 1` must be set as a query param (not in requestBody) or the Meet link is not created.
- `requestId` in `conferenceData.createRequest` must be a unique UUID per event for idempotency.
- `sendUpdates: "all"` emails both attendees automatically.

---

## Event Deletion: events.delete

```ts
await calendar.events.delete({
  calendarId: "primary",
  eventId: googleEventId,
  sendUpdates: "all",   // Sends cancellation emails
});
```

---

## MockCalendarService (`lib/integrations/calendar/MockCalendarService.ts`)

Deterministic behavior — no network calls, in-memory store:

```ts
import { randomUUID } from "crypto";
import type { ICalendarService, AvailableSlot, CalendarEvent } from "./ICalendarService";

export class MockCalendarService implements ICalendarService {
  async getAvailableSlots(
    _interviewerEmail: string,
    dateStart: Date,
    dateEnd: Date,
    slotDurationMinutes = 60
  ): Promise<AvailableSlot[]> {
    const slots: AvailableSlot[] = [];
    const cursor = new Date(dateStart);
    cursor.setHours(9, 0, 0, 0);

    while (cursor < dateEnd && slots.length < 5) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
        const end = new Date(cursor.getTime() + slotDurationMinutes * 60_000);
        if (end.getHours() <= 17) slots.push({ start: new Date(cursor), end });
      }
      cursor.setHours(cursor.getHours() + 1);
    }
    return slots;
  }

  async holdSlot(
    _interviewerEmail: string,
    _candidateName: string,
    _candidateEmail: string,
    _startTime: Date,
    _endTime: Date
  ): Promise<CalendarEvent> {
    return {
      googleEventId: `mock-${randomUUID().slice(0, 8)}`,
      meetLink: `https://meet.google.com/mock-${randomUUID().slice(0, 8)}`,
    };
  }

  async releaseSlot(_interviewerEmail: string, _googleEventId: string): Promise<void> {
    // no-op in mock
  }
}
```

---

## Factory (`lib/integrations/calendar/index.ts`)

```ts
import { MockCalendarService } from "./MockCalendarService";
import { GoogleCalendarService } from "./GoogleCalendarService";
import type { ICalendarService } from "./ICalendarService";

export function getCalendarService(): ICalendarService {
  if (process.env.USE_MOCK_CALENDAR === "true") {
    return new MockCalendarService();
  }
  return new GoogleCalendarService();
}
```

---

## OAuth Setup Flow (one-time, per interviewer)

1. Admin visits `/api/auth/google` → redirected to Google consent screen
2. Google redirects to `/api/auth/google/callback?code=...`
3. Callback exchanges code for `{ access_token, refresh_token }` via `oauth2Client.getToken(code)`
4. Tokens are AES-256-GCM encrypted and saved to `InterviewerCredentials` table
5. All subsequent API calls auto-refresh via `oauth2Client.on('tokens')` event

---

## Phase 03 Implementation Order

1. `ICalendarService` interface
2. `MockCalendarService` (no external deps)
3. Factory (`index.ts`) — returns mock when `USE_MOCK_CALENDAR=true`
4. `POST /api/admin/applications/[id]/offer-slots` — generates slots, creates `InterviewSlot` rows (HELD), emails candidate
5. Candidate scheduling page `/schedule/[token]` — JWT-gated, pick a slot
6. `POST /api/schedule/confirm` — confirms slot, creates `Interview` row, updates calendar event
7. `GoogleCalendarService` + `InterviewerCredentials` schema + OAuth endpoints (swap in for real)

---

## Key Gotchas

- **`prompt: "consent"`** in `generateAuthUrl` is required to get `refresh_token` on every auth. Without it, Google only sends `refresh_token` on first auth; subsequent auths skip it.
- **Never overwrite the stored `refresh_token`** with a new token response that doesn't include one — Google omits it after the first time. Merge new fields into the stored token object.
- **`conferenceDataVersion: 1`** is a query parameter on `events.insert`, not part of `requestBody`. Missing it silently skips Meet link creation.
- On Windows dev: restart the Next.js server after any `.env.local` changes.
