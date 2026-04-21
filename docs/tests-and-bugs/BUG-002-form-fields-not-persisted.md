# BUG-002 — phone / yearsOfExperience / coverLetter silently dropped

## Status
Fixed — `prisma/schema.prisma` + `lib/services/applicationService.ts`

## Symptom
Candidates fill in Phone, Years of Experience, and Cover Letter on the application
form. The submission succeeds (201 OK) and a confirmation email is sent. But when an
admin opens the candidate detail page, those three fields are missing — they were never
saved to the database.

There is no error, no warning, no indication to the candidate or the admin that data
was lost.

## Root Cause
A mismatch between three layers that were built independently:

| Layer | State |
|-------|-------|
| `components/candidate/ApplicationForm.tsx` | Renders `phone`, `yearsOfExperience`, `coverLetter` inputs and includes them in the `FormData` POST |
| `app/api/apply/route.ts` | Reads all three from `formData` and passes them to `submitApplication()` |
| `lib/services/applicationService.ts` | Calls `createApplication(...)` but **omits** phone, yearsOfExperience, coverLetter from the object |
| `prisma/schema.prisma` — `Application` model | **None of the three fields existed** |

Because the Prisma schema had no columns for these fields, the generated client would
throw `PrismaClientValidationError: Unknown argument 'phone'` if the service had tried
to pass them. Since the service already omitted them, no error was ever thrown — the
data just vanished.

## Why This Happened
The frontend form was built to a richer spec than the initial Prisma schema. The spec
listed the fields as "inputs" but they were not carried through to the data model. The
service layer was the last integration point and it only mapped the fields that existed
in the schema at the time it was written.

**Lesson for future assistants:** When adding or changing form fields, always trace the
complete path:

```
UI input → FormData name → API route read → service input type → createX() call → Prisma schema field
```

If any link in that chain is missing, the data is silently dropped. A missing Prisma
field does not cause a runtime error unless the service actually tries to write it.

## Fix Applied

**1. Added columns to `prisma/schema.prisma`:**
```prisma
model Application {
  ...
  linkedinUrl       String?
  githubUrl         String?
  phone             String?       // ← added
  yearsOfExperience Int?          // ← added
  coverLetter       String?  @db.Text  // ← added
  resumeUrl         String
  ...
}
```

**2. Pushed schema to the database:**
```bash
npx dotenv-cli -e .env.local -- npx prisma db push
```

**3. Passed fields in `applicationService.ts`:**
```ts
const application = await createApplication({
  ...
  phone: input.phone,
  yearsOfExperience: input.yearsOfExperience,
  coverLetter: input.coverLetter,
  ...
});
```

**4. Surfaced fields in the admin detail page** (`app/admin/applications/[id]/page.tsx`):
- Phone and years of experience shown in the candidate header
- Cover letter rendered in its own section

## Important: Dev Server Must Restart After Schema Change
Turbopack (Next.js dev server) caches the Prisma client module in memory. After running
`prisma db push` + `prisma generate`, **restart the dev server** so Turbopack re-compiles
with the updated client. Without a restart, the old client is used and the
`PrismaClientValidationError: Unknown argument 'phone'` error is thrown at runtime.

## Key Files
- `prisma/schema.prisma` — three new optional columns
- `lib/services/applicationService.ts` — three new fields passed to `createApplication`
- `app/admin/applications/[id]/page.tsx` — admin UI updated to display them

## How to Verify
Run the happy-path Playwright test and then open the admin detail page for the
submitted application. Phone, years of experience, and cover letter should all be
visible.

```bash
npx playwright test --grep "happy path"
```
