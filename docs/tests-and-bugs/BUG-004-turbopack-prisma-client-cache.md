# BUG-004 — Turbopack caches stale Prisma client after schema change

## Status
Documented — operational gotcha, not a code bug. Restart the dev server after every
`prisma db push` + `prisma generate`.

## Symptom
After adding new columns to `prisma/schema.prisma` and running `prisma db push` +
`prisma generate`, the Next.js API route throws:

```
PrismaClientValidationError: Unknown argument 'phone'. Available options are marked
with ?.
```

The new fields exist in the database (verified via Supabase SQL editor) and in the
generated Prisma client source files on disk. But the running server still rejects them.

## Root Cause
Turbopack (the Next.js 15/16 dev bundler) compiles modules at startup and caches
compiled module graphs in memory. The Prisma client ships a native binary
(`.node` / `.dll.node`) that is loaded once when the process starts. Turbopack does
not hot-reload native modules — it holds an open file handle to the binary, which
means:

1. `prisma generate` writes new JS + native files to `node_modules/.prisma/client/`.
2. Turbopack's in-memory module cache still points to the *old* compiled module.
3. On Windows, the old `.dll.node` is locked (EPERM) so `generate` cannot even
   overwrite the binary while the dev server is running — generating while the server
   is up may silently leave the old binary in place.

Result: the running server uses the pre-migration client schema, which does not know
about the new columns.

## Why This Happened
The same process that works for plain JS/TS source files (where Turbopack HMR picks up
the change immediately) does not apply to generated native clients. This is a known
limitation of Turbopack and native Node.js addons.

**Lesson for future assistants:** After any `prisma db push` + `prisma generate`:

1. **Stop the dev server first** (before or during `prisma generate`) so Windows
   releases the lock on the `.dll.node` file.
2. **Start the dev server again** so Turbopack re-compiles with the updated client.

The order that works reliably:
```bash
# 1. Stop dev server (Ctrl-C in the terminal running `npm run dev`)
# 2. Push schema + regenerate client
npx dotenv-cli -e .env.local -- npx prisma db push
# (prisma generate runs automatically after db push)
# 3. Restart dev server
npm run dev
```

Never run `prisma db push` while the dev server is running on Windows — the EPERM
error on the native binary may leave the client in a partially-updated state.

## Key Files
- `prisma/schema.prisma` — schema changes trigger this
- `node_modules/.prisma/client/` — generated client (do not commit; in `.gitignore`)

## How to Verify
After adding a new field and following the steps above, the field should be writable
without `PrismaClientValidationError`. The Playwright happy-path test exercises this:

```bash
npx playwright test --grep "happy path"
```
