# Implementation Deviations Log

Tracks every place where the actual implementation differs from the original plan.
Read this before assuming the architecture doc or original spec reflects reality.

---

## DEV-01 — PDF parser is `unpdf` + `pdfjs-dist`, not `pdf-parse`

**Original plan:** Use `pdf-parse` for resume text extraction.

**What was built:** `unpdf` configured with `pdfjs-dist/legacy/build/pdf.mjs` as the backend.

**Why:**
`pdf-parse` requires `canvas` and worker globals that are unavailable in Next.js API routes (both Webpack and Turbopack). It crashes silently with exit code 1 or hangs indefinitely.

**How it works:**
`lib/services/resumeService.ts` calls `configureUnPDF()` once (singleton) with the legacy Node.js pdfjs build, pointing the worker at `file:///.../pdf.worker.mjs`. This gives full Node.js-compatible PDF parsing without browser globals.

**Do not revert.** Do not use `pdf-parse` or `pdfjs-dist` directly (without `unpdf` wrapper).

---

## DEV-02 — `/api/apply` is the submission endpoint, not `/api/applications`

**Original plan:** `POST /api/applications` is the canonical submission route.

**What was built:** `/api/apply` is the real frontend submission route. It maps `roleId`/`name`/`email` from the application form to the service contract, then delegates to `applicationService.createApplication()`.

`/api/applications` still exists but is the internal/canonical route. The frontend always hits `/api/apply`.

**Why:** The form field names (`roleId`, `name`) differ from the service contract field names (`jobId`, `candidateName`). A dedicated mapping route keeps the transform explicit.

---

## DEV-03 — Job model has `team`, not `department`

**Original plan:** Jobs have a `department` field.

**What was built:** Prisma schema uses `team` (`Job.team: String`).

**Impact:** Use `lib/utils/jobTransform.ts` (`toJobSummary`, `toJobDetail`) whenever exposing Job data to the frontend. Never read `job.department` — it doesn't exist.

---

## DEV-04 — Server components call repositories directly

**Original plan:** Server components fetch data via `fetch(NEXT_PUBLIC_APP_URL/api/...)`.

**What was built:** Server components import from `lib/repositories/` or `lib/prisma` directly.

**Why:** Self-fetching from server components broke on port mismatch during dev (Next.js doesn't guarantee the port is available when SSR runs). Direct repository calls are faster and eliminate the round-trip.

**Exception:** `app/admin/applications/page.tsx` imports `prisma` directly — acceptable for read-only dashboard server components. Do not extend this pattern to write operations.

---

## DEV-05 — Storage upload is non-fatal

**Original plan:** Application submission fails if Supabase Storage upload fails.

**What was built:** Application is saved to DB even if storage fails. `resumeUrl` is set to `"pending"` if upload fails and updated on success.

**Why:** Resume storage failure should not block a candidate from applying. The resume text is always extracted and stored in `Application.resumeText` regardless.

---

## DEV-06 — Admin pipeline is two separate client-side tables

**Original plan:** Single `CandidateTable` with filter controls.

**What was built:**
- `NewApplicationsTable` — shows only `APPLIED` applications with per-row Screen button and Batch Scan
- `PipelineTable` — shows everything post-`APPLIED` with tab filters (Screened / Shortlisted / Interviewing / Offered)
- `AdminPipelineClient` — "use client" orchestrator that owns state for both tables, drives live per-row screening without page reloads

`CandidateTable` is kept for the candidate detail page sidebar only.

**Why:** Separating unscreened from screened reduces cognitive load. The batch scan needs to animate rows moving between tables in real-time, which required lifting state to a shared client component.

---

## DEV-07 — Batch scan runs on the client, not a single server call

**Original plan:** `POST /api/admin/applications/batch-screen` screens all APPLIED in one request.

**What was built:** The `/batch-screen` route exists as a fallback, but the UI fires individual `/screen` requests sequentially from `AdminPipelineClient`. Each completion updates local React state, moving the row from Table 1 to Table 2 immediately without a page reload.

**Why:** A single server call can't stream per-row progress to the browser. Client-side sequential fetches give live feedback at the cost of more HTTP round-trips (acceptable at 1–20 candidates).

---

## DEV-08 — Schedule JWT is 48h, not single-use

**Original plan:** Magic links are single-use (invalidated after first use).

**What was built:** `lib/auth/scheduleToken.ts` signs a 48h JWT. The `/schedule/[token]` page re-verifies on every load but does not invalidate the token after use.

**Why:** Single-use enforcement requires a DB table of used tokens and an atomic check-and-mark. Deferred to Phase 03 Part 2. The practical risk is low — once a slot is confirmed, the page shows "already scheduled" on re-visit.

---

## DEV-09 — `rationale` field max length raised from 500 to 600 chars

**Original plan / schema:** `ScreeningResultSchema.rationale: z.string().max(500)`

**What was built:** Raised to `max(600)`. Prompt updated to say "under 600 characters".

**Why:** Gemini 2.5-flash consistently generates 600–700 char rationales despite the "2-4 sentences" instruction. After 5 failed retries the batch scan would error out. 600 is the observed practical ceiling.

---

## DEV-10 — Mock calendar slot generation uses fixed hours per day

**Original plan:** `MockCalendarService` returns hourly slots from 9am–5pm.

**What was built:** Offers exactly 3 slots per business day — 9am, 11am, 2pm — capped at 5 total. This gives realistic interview times without flooding the candidate with 8 options per day.
