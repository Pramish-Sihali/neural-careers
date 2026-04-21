# BUG-003 — Supabase signed URL always returns "File unavailable"

## Status
Fixed — `app/admin/applications/[id]/page.tsx`

## Symptom
The admin candidate detail page shows a "Resume File" section. After a candidate
successfully uploads a PDF, the section always displays "File unavailable" and no
iframe is rendered. The signed URL request to Supabase returns an error even though
the file exists in the bucket.

## Root Cause
Supabase Storage organises files inside named buckets. The bucket is called `resumes`.
Within that bucket, resumes are stored at the path `resumes/{applicationId}.pdf` —
that is, there is a subdirectory named `resumes` *inside* the bucket.

The original `getResumeSignedUrl` function stripped the leading `resumes/` prefix
before calling `createSignedUrl`:

```ts
// WRONG — strips the subdirectory that actually exists in the bucket
const { data, error } = await supabase.storage
  .from("resumes")
  .createSignedUrl(storagePath.replace(/^resumes\//, ""), 60 * 30);
```

This left only `{applicationId}.pdf` as the path. Because the file lives at
`resumes/{applicationId}.pdf` inside the bucket, Supabase could not find it and
returned an error. The function caught the error silently and returned `null`,
causing the UI to show "File unavailable" with no further indication.

## Why This Happened
The storage path stored in `resumeUrl` in the database is the full within-bucket
path including the subdirectory (`resumes/{id}.pdf`). The `createSignedUrl` call
in the page component assumed the path was relative to the subdirectory and tried
to strip the prefix, but the Supabase client's `from("resumes")` already scopes
all operations to the bucket root — no prefix stripping is needed.

**Lesson for future assistants:** When calling `supabase.storage.from(bucket).createSignedUrl(path, ...)`,
`path` is the full path as stored in the database, relative to the bucket root.
Do not manipulate it. Whatever string `applicationService.ts` writes to `resumeUrl`
must be passed verbatim to `createSignedUrl`.

```
DB resumeUrl column value  →  passed verbatim to createSignedUrl  →  signed URL
```

Stripping any part of this path breaks the lookup silently.

## Fix Applied

Removed the `.replace()` call in `getResumeSignedUrl`:

```ts
// BEFORE (broken)
.createSignedUrl(storagePath.replace(/^resumes\//, ""), 60 * 30)

// AFTER (correct)
.createSignedUrl(storagePath, 60 * 30)
```

The signed URL now resolves correctly and the iframe renders the PDF.

## Key Files
- `app/admin/applications/[id]/page.tsx` — `getResumeSignedUrl` function

## How to Verify
1. Submit a new application with a valid PDF resume.
2. Open the admin detail page for that application.
3. The "Resume File" section should show an `<iframe>` with the PDF rendered inline,
   and an "Open PDF" link that opens the file in a new tab.

```bash
npx playwright test --grep "PDF viewer iframe"
```
