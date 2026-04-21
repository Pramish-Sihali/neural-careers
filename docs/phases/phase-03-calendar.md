# Phase 03 — Calendar Orchestration

## Status
- **Part 1 (Mock):** ✅ Complete
- **Part 2 (Real Google OAuth):** 🔄 Pending

---

## What Was Built (Part 1)

### Flow
```
Admin: Shortlist candidate
  → click "Offer Interview Slots" on candidate detail page
  → POST /api/admin/applications/[id]/offer-slots
  → MockCalendarService generates 5 slots (next business days, 9am/11am/2pm)
  → 5 InterviewSlot rows created (status=HELD, holdExpiresAt=48h)
  → JWT schedule token signed (48h expiry)
  → InterviewInvite email sent to candidate with /schedule/[token] link

Candidate: opens /schedule/[token]
  → JWT verified server-side
  → HELD slots loaded and displayed
  → clicks "Book this slot"
  → POST /api/schedule/confirm { token, slotId }
  → chosen slot → CONFIRMED
  → other 4 slots → RELEASED (calendar events deleted)
  → Interview row created (status=SCHEDULED)
  → Application status → INTERVIEWING
  → Confirmation email sent to candidate
```

### New Files
| File | Purpose |
|------|---------|
| `lib/integrations/calendar/ICalendarService.ts` | Interface contract |
| `lib/integrations/calendar/MockCalendarService.ts` | Deterministic mock (no network calls) |
| `lib/integrations/calendar/index.ts` | Factory (`USE_MOCK_CALENDAR=true` → mock) |
| `lib/services/calendarService.ts` | Orchestration: `offerInterviewSlots()`, `confirmInterviewSlot()` |
| `lib/auth/scheduleToken.ts` | `jose` JWT sign/verify for schedule links |
| `emails/InterviewInvite.tsx` | Slot-offer email template + `renderInterviewInviteEmail()` plain HTML |
| `app/api/admin/applications/[id]/offer-slots/route.ts` | POST: trigger slot offering |
| `app/api/schedule/confirm/route.ts` | POST: candidate confirms chosen slot |
| `app/schedule/[token]/page.tsx` | Candidate scheduling page (server component) |
| `app/schedule/[token]/SlotPicker.tsx` | Client component for slot selection |

### Admin UI Changes
- `ScreenActions.tsx` — added **"Offer Interview Slots"** button for `SHORTLISTED` status
- `AdminCalendar.tsx` — calendar on pipeline page now auto-populates from `InterviewSlot` rows

---

## Acceptance Criteria (Part 1) ✅

- [x] Admin can offer slots to a SHORTLISTED candidate in one click
- [x] Candidate receives email with all 5 available times
- [x] Candidate scheduling page works without login
- [x] Selecting a slot confirms it and releases all others atomically
- [x] Application moves to INTERVIEWING on confirmation
- [x] Confirmation email sent to candidate
- [x] Calendar widget on admin page shows booked slots

---

## Part 2 — Real Google Calendar (Pending)

### What needs to be built
1. **`InterviewerCredentials` Prisma model** — stores encrypted OAuth refresh tokens
2. **`lib/integrations/calendar/tokenCrypto.ts`** — AES-256-GCM encrypt/decrypt
3. **`lib/integrations/calendar/googleOAuth.ts`** — OAuth2 client singleton + token refresh
4. **`lib/integrations/calendar/GoogleCalendarService.ts`** — real `ICalendarService` implementation
5. **`app/api/auth/google/route.ts`** — redirects admin to Google consent screen
6. **`app/api/auth/google/callback/route.ts`** — exchanges code for tokens, saves to DB
7. **Background expiry job** — sets HELD → EXPIRED after holdExpiresAt passes
8. **Nudge email** — reminder to candidate after 24h of no slot selection

### What the admin needs to provide
- Google Cloud Console project with Calendar API enabled
- OAuth 2.0 Client ID (Web Application type)
- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`

### Swap-in
Once `GoogleCalendarService` is implemented, changing `USE_MOCK_CALENDAR=false` in `.env.local`
activates the real service. The candidate scheduling page (`/schedule/[token]`) requires no changes.

---

## Edge Cases

| Case | Handling |
|------|---------|
| Candidate visits expired link | JWT verification fails → "Link expired" page |
| Candidate visits link after already booking | `status === "INTERVIEWING"` check → "Already scheduled" page |
| No HELD slots left | Empty slots array → "No slots available" page |
| Two candidates race to confirm same slot | `status === "HELD"` check in `confirmInterviewSlot` → second gets `SlotConfirmError` |
| Admin re-offers slots | Existing HELD slots released, 5 fresh slots created |
| Slot holdExpiresAt passes | Background job (Part 2) sets HELD → EXPIRED; candidate sees no slots |

---

## Environment Variables

```bash
USE_MOCK_CALENDAR=true              # switch to false for real Google Calendar
INTERVIEWER_EMAIL=interviewer@niural.com
GOOGLE_CLIENT_ID=                   # Part 2
GOOGLE_CLIENT_SECRET=               # Part 2
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_TOKENS_ENCRYPTION_KEY=       # 32-byte hex, generate once
GOOGLE_CALENDAR_TIMEZONE=America/New_York
JWT_SECRET=                         # signs schedule tokens
```

---

## Reference
- Architecture deep-dive: `docs/architecture/google-calendar-integration.md`
