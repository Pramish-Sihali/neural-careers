# BUG-001 — unpdf crashes in Next.js API routes (browser-only PDF.js bundle)

## Status
Fixed — `lib/services/resumeService.ts`

## Symptom
- Submit button freezes on "Submitting…" indefinitely
- No success banner, no error message shown to the candidate
- Playwright captures `API /api/apply → status 0 null` (connection dropped, not even an HTTP error)
- Dev server terminal shows no error — the process simply kills the connection

## Root Cause
`unpdf` v1.6.0 ships a **browser-only build** of PDF.js (`unpdf/pdfjs`) as its default
PDF engine. This build references browser globals at evaluation time:

```
window.screen.availWidth
document.createElement(...)
window.matchMedia(...)
```

In a plain Node.js process (e.g. running `node script.mjs`) these globals don't exist at
all, so the process crashes immediately with exit code 1 and dumps the minified
`pdfjs.mjs` source to stderr.

In a **Next.js 15/16 App Router API route** (Turbopack dev), `window` and `document`
**are polyfilled server-side**. So `unpdf/pdfjs` partially initialises, but then hangs
waiting for a Web Worker that can never spawn in that environment. The HTTP connection
is eventually dropped with no response — which is why the client sees status 0 instead
of a 500.

The try/catch in the API route handler (`app/api/apply/route.ts`) never executes because
the crash happens below the catch boundary (worker initialisation is asynchronous and
outside the awaited chain at crash time).

## Why This Happened
The `IMPLEMENTATION-DEVIATIONS.md` (DEV-02) documents that `pdf-parse` was replaced
with `unpdf` because `pdf-parse` required browser globals. The intention was correct,
but `unpdf` v1.6.0 regressed: it switched from a serverless-friendly bundle to a
full browser PDF.js build, reintroducing the exact same problem.

**Lesson for future assistants:** When a library is chosen specifically to avoid browser
globals in a server context, verify the installed version still ships a
Node.js-compatible build before assuming it works. Run a quick standalone Node.js test
(`node --input-type=module`) against the installed package before using it in the
Next.js API route.

## Fix Applied
Installed `pdfjs-dist` and configured `unpdf` to use its Node.js-compatible legacy
build instead of the bundled browser build.

```ts
// lib/services/resumeService.ts
let _unpdfConfigured: Promise<void> | null = null;

function ensureUnpdfConfigured(): Promise<void> {
  if (!_unpdfConfigured) {
    _unpdfConfigured = (async () => {
      const { configureUnPDF } = await import("unpdf");
      await configureUnPDF({
        pdfjs: async () => {
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
          const workerPath = resolve(
            process.cwd(),
            "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
          );
          pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
          return pdfjs;
        },
      });
    })();
  }
  return _unpdfConfigured;
}
```

`configureUnPDF` is a singleton — the first call spawns the worker; all subsequent
calls return the cached promise immediately. The worker file is resolved via
`process.cwd()` (project root) + `pathToFileURL` so the path is always a valid
`file://` URL regardless of OS.

## Key Files
- `lib/services/resumeService.ts` — fix lives here
- `docs/architecture/IMPLEMENTATION-DEVIATIONS.md` — DEV-02 explains original choice
- `package.json` — `pdfjs-dist` added as a direct dependency

## How to Verify
```bash
# Standalone Node.js smoke test (runs without Next.js):
node --input-type=module << 'EOF'
import { configureUnPDF, extractText } from './node_modules/unpdf/dist/index.mjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
await configureUnPDF({
  pdfjs: async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    ).href;
    return pdfjs;
  }
});
const buf = readFileSync('./tests/fixtures/test-resume.pdf');
const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
console.log('OK — text length:', text.length);
EOF

# Or run the Playwright suite:
npx playwright test
```
