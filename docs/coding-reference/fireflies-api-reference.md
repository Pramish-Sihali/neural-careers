# Fireflies API Reference

Verified against live API calls on 2026-04-21. Use this before touching any Fireflies integration code.

---

## Authentication

All requests use a Bearer token in the `Authorization` header:

```
Authorization: Bearer <FIREFLIES_API_KEY>
POST https://api.fireflies.ai/graphql
Content-Type: application/json
```

---

## Webhook Signature Verification

Fireflies signs every webhook POST with HMAC-SHA256 over the raw request body.

- **Header sent**: `x-hub-signature: sha256=<hex>` (GitHub-style — NOT `x-webhook-secret`)
- **Key**: `FIREFLIES_WEBHOOK_SECRET` — set once in the Fireflies dashboard, mirrored in Vercel env vars
- **Verification**: compute `HMAC-SHA256(rawBody, secret)`, prefix with `sha256=`, compare with `timingSafeEqual`
- **No timestamp header** — replay protection is not possible; use `transcriptFetchedAt` idempotency instead
- **Only one event type**: `"Transcription completed"` — there is no "bot joined" pre-event

See `DEV-19` in `IMPLEMENTATION-DEVIATIONS.md` for the full context and why the original `x-webhook-secret` approach failed.

---

## Queries

### `transcripts(limit: N)` — List recent transcripts

```graphql
query {
  transcripts(limit: 3) {
    id
    title
    date          # Unix ms timestamp of meeting start
    duration      # minutes (float)
    participants  # array of email strings
    meeting_attendees {
      displayName
      email
      phoneNumber
      name
    }
    meeting_link  # Google Meet / Zoom URL — ALWAYS present, key for URL-based matching
    summary {
      overview
      action_items
      keywords
      gist
      bullet_gist
      shorthand_bullet
      outline
    }
  }
}
```

### `transcript(id: String!)` — Fetch single transcript

```graphql
query GetTranscript($id: String!) {
  transcript(id: $id) {
    id
    title
    date
    duration
    host_email
    organizer_email
    participants
    meeting_attendees {
      displayName
      email
      phoneNumber
      name
    }
    meeting_link     # Google Meet URL — confirmed present even for calendar-invite-joined meetings
    cal_id           # Google Calendar event ID — null when bot joined via addToLiveMeeting
    calendar_type    # "Google Calendar" | null
    privacy          # "link" | "private"
    sentences {
      index
      speaker_name
      raw_text       # verbatim transcription
      text           # cleaned transcription
      start_time     # seconds from meeting start
      end_time
      ai_filters {
        task           # extracted action item, or null
        pricing        # pricing mention, or null
        metric         # metric mentioned, or null
        question       # question asked, or null
        date_and_time  # date/time mention, or null
        text_cleanup   # reformatted sentence text
      }
    }
    summary {
      overview        # paragraph summary — null if meeting too short/no content
      action_items    # bullet list of action items
      keywords        # comma-separated key topics
      gist            # 1-2 sentence TL;DR
      bullet_gist     # bullet-point summary
      shorthand_bullet
      outline         # structured outline of discussion
    }
  }
}
```

**Note**: `summary` is `null` for meetings under ~5 minutes or with insufficient speech content.

### `user` — Fetch account info

```graphql
query {
  user {
    user_id
    name
    email
    num_transcripts
    recent_meeting   # ID of most recent transcript
    minutes_consumed
    is_admin
    integrations     # null unless integrations are connected
  }
}
```

**Fields that do NOT exist** (validated against schema — will throw `GRAPHQL_VALIDATION_FAILED`):
- `language`, `record_ai_apps` on `Transcript`
- `questions` on `Summary`
- `next_upcoming_meeting`, `last_login` on `User`

---

## Mutations

### `addToLiveMeeting` — Invite Fireflies bot to a running meeting

```graphql
mutation AddToLiveMeeting($url: String!) {
  addToLiveMeeting(meeting_link: $url) {
    success
    message
  }
}
```

**Important**: This mutation returns only `{success, message}` — it does **not** return the Fireflies meetingId. You cannot know the meetingId until after the transcript is processed and the webhook fires. This means `addToLiveMeeting` alone cannot solve the meetingId-linkage problem.

---

## Webhook Payload

```json
{
  "event_type": "Transcription completed",
  "meetingId": "<fireflies_transcript_id>",
  "clientReferenceId": null
}
```

- `clientReferenceId` — only populated for audio file uploads via the API, not for calendar-invite or `addToLiveMeeting` joined meetings
- The webhook body contains no timestamp field, so 5-minute replay protection (used for Slack/GitHub) is not applicable

---

## meetingId Linkage Strategy (Approach 3 — URL Matching)

The core problem: Fireflies assigns a `meetingId` internally and sends it only in the webhook. Our `Interview` records have `firefliesMeetingId = null` at creation time.

**Solution**: Store the Google Meet `hangoutLink` on `Interview.meetingUrl` when the calendar event is created. When the webhook fires:

1. Try `Interview.findFirst({ where: { firefliesMeetingId: body.meetingId } })` — fast path for already-linked interviews
2. On miss: fetch `transcript(id: body.meetingId)` from Fireflies to get `transcript.meeting_link`
3. Match `Interview.findFirst({ where: { meetingUrl: transcript.meeting_link } })`
4. On match: set `Interview.firefliesMeetingId = body.meetingId`, then call `processTranscript()`

This works because `meeting_link` (the Google Meet URL) is always present in Fireflies transcripts, including for calendar-invite joined meetings.

See `app/api/webhooks/fireflies/route.ts` and `lib/services/calendarService.ts` for implementation.

---

## Summary Fields We Store

Currently `notetakerService.ts` stores only `summary.overview` as `transcriptSummary`. Available for future extension:

| Field | Use case |
|-------|----------|
| `gist` | One-liner for admin list view |
| `bullet_gist` | Quick-scan panel in admin detail |
| `action_items` | Follow-up task extraction |
| `keywords` | Tag cloud / search indexing |
| `outline` | Structured interview topics |
| `sentences[].ai_filters.question` | Extract all candidate questions |
| `sentences[].ai_filters.task` | Extract commitments made in the interview |
