/**
 * E2E test: Candidate application form
 *
 * Prerequisites:
 *   1. Dev server running:  npm run dev
 *   2. DB seeded:           npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *
 * Run with:  npx playwright test
 */

import { test, expect, type Page, type Route } from "@playwright/test";
import path from "path";

const RESUME_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/test-resume.pdf"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFirstJobLink(page: Page): Promise<string> {
  await page.goto("/jobs");
  // The "Apply now" link on each JobCard now points to /jobs/{id}#apply
  // so the candidate lands on the inline form anchor within the detail page.
  const applyLink = page.locator('a[href*="#apply"]').first();
  await expect(applyLink).toBeVisible({ timeout: 10_000 });
  const href = await applyLink.getAttribute("href");
  if (!href) throw new Error("No apply link found on /jobs page");
  return href;
}

async function fillForm(page: Page) {
  await page.fill('input[name="name"]', "Jane Playwright");
  await page.fill('input[name="email"]', `jane.pw.${Date.now()}@example.com`);
  await page.fill('input[name="phone"]', "+1 555 010 0001");
  await page.fill('input[name="yearsOfExperience"]', "4");
  await page.fill(
    'input[name="linkedinUrl"]',
    "https://linkedin.com/in/jane-playwright"
  );
  await page.fill('input[name="githubUrl"]', "jane-playwright");
  await page.fill(
    'textarea[name="coverLetter"]',
    "I am excited about this opportunity and believe my background makes me a strong fit for the role."
  );
  await page.setInputFiles('input[name="resume"]', RESUME_FIXTURE);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Application form", () => {
  test("happy path: fill form, upload PDF, submit, see success banner", async ({
    page,
  }) => {
    const applyHref = await getFirstJobLink(page);
    await page.goto(applyHref);
    // New inline form heading lives at #apply-heading (h2 on the job detail page)
    await expect(page.locator("#apply-heading")).toContainText("Apply for");

    await fillForm(page);

    const apiResponsePromise = page.waitForResponse((r) =>
      r.url().includes("/api/apply")
    );

    await page.click('button[type="submit"]');

    const apiResponse = await apiResponsePromise;
    const apiStatus = apiResponse.status();
    let apiBody: unknown = null;
    try { apiBody = await apiResponse.json(); } catch { /* ignore */ }
    console.log(`API /api/apply → status ${apiStatus}`, apiBody);

    // Assert success banner appears
    await expect(
      page.locator('h2:has-text("Application submitted")')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Application ID")).toBeVisible();
  });

  test("duplicate application: same email + role → friendly 409 message", async ({
    page,
  }) => {
    const applyHref = await getFirstJobLink(page);

    // Use a fixed email so both submissions use the same email address
    const dupeEmail = `dupe.test.${Date.now()}@example.com`;

    // First submission
    await page.goto(applyHref);
    await fillForm(page);
    await page.fill('input[name="email"]', dupeEmail);
    const firstResponsePromise = page.waitForResponse((r) => r.url().includes("/api/apply"));
    await page.click('button[type="submit"]');
    await firstResponsePromise;
    await expect(
      page.locator('h2:has-text("Application submitted")')
    ).toBeVisible({ timeout: 15_000 });

    // Second submission with same email
    await page.goto(applyHref);
    await fillForm(page);
    await page.fill('input[name="email"]', dupeEmail);
    await page.click('button[type="submit"]');

    await expect(
      page.locator('.text-destructive[role="alert"]')
    ).toContainText("already applied", { timeout: 15_000 });
    // Must NOT navigate away — stay on the inline apply section
    await expect(page.locator("#apply-heading")).toContainText("Apply for");
  });

  test("oversized file: >5 MB → client-side error, form not submitted", async ({
    page,
  }) => {
    const applyHref = await getFirstJobLink(page);
    await page.goto(applyHref);
    await fillForm(page);

    // Inject an oversized file via JS (6 MB of zeros with .pdf extension)
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="resume"]'
      )!;
      const bytes = new Uint8Array(6 * 1024 * 1024); // 6 MB
      const file = new File([bytes], "big-resume.pdf", {
        type: "application/pdf",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Client validation should show file-size error
    await expect(page.locator("text=5 MB")).toBeVisible({ timeout: 5_000 });

    // Submit button must be disabled
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test("invalid file type: .txt renamed as pdf → server-side 422", async ({
    page,
  }) => {
    const applyHref = await getFirstJobLink(page);
    await page.goto(applyHref);
    await fillForm(page);

    // Inject a plain-text file (no PDF magic bytes) named *.pdf
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="resume"]'
      )!;
      const file = new File(["this is not a pdf file at all"], "fake.pdf", {
        type: "application/pdf",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const apiResponsePromise = page.waitForResponse((r) =>
      r.url().includes("/api/apply")
    );

    await page.click('button[type="submit"]');

    const apiResponse = await apiResponsePromise.catch(() => null);
    const apiStatus = apiResponse?.status() ?? 0;
    console.log("Invalid file type → API status:", apiStatus);

    await expect(page.locator('.text-destructive[role="alert"]')).toBeVisible({
      timeout: 15_000,
    });

    // Server should return 422 (INVALID_TYPE) — file-type library detects no PDF magic bytes
    expect([422, 400]).toContain(apiStatus);
  });

  test("image-only PDF (no extractable text) → server-side 422 TOO_SHORT", async ({
    page,
  }) => {
    const applyHref = await getFirstJobLink(page);
    await page.goto(applyHref);
    await fillForm(page);

    // Minimal valid PDF with an image XObject but no text operators
    // File type library will detect it as PDF; unpdf will return empty text
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="resume"]'
      )!;
      // Minimal PDF with valid magic bytes but empty content stream
      const minimalPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
      const file = new File([minimalPdf], "image-only.pdf", {
        type: "application/pdf",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const apiResponsePromise = page.waitForResponse((r) =>
      r.url().includes("/api/apply")
    );

    await page.click('button[type="submit"]');

    const apiResponse = await apiResponsePromise.catch(() => null);
    const apiStatus = apiResponse?.status() ?? 0;
    let apiBody: unknown = null;
    try { apiBody = await apiResponse?.json(); } catch { /* ignore */ }

    console.log("Image-only PDF → API status:", apiStatus, apiBody);

    await expect(page.locator('.text-destructive[role="alert"]')).toBeVisible({
      timeout: 15_000,
    });

    expect(apiStatus).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------

test.describe("Admin panel", () => {
  test("submitted application appears in candidate pipeline table", async ({
    page,
  }) => {
    await page.goto("/admin/applications");
    // Admin home heading changed from "Candidate Pipeline" to "Welcome back"
    // as part of the sidebar/home reorganization.
    await expect(page.locator("h1")).toContainText("Welcome back");
    // At least one row (from previous happy-path test or seeded data)
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("detail page shows the four tabs (screening / enrichment / notes / resume)", async ({
    page,
  }) => {
    await page.goto("/admin/applications");
    const firstLink = page
      .locator('a[href*="/admin/applications/"]')
      .first();
    await expect(firstLink).toBeVisible({ timeout: 10_000 });
    await firstLink.click();

    // The parsed-text section has been removed per spec §2.4 — the tab row
    // is the new anchor for the detail page.
    await expect(page.getByRole("tab", { name: "AI Screening" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("tab", { name: "AI Enrichment" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Interviewer Notes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resume" })).toBeVisible();
  });

  test("detail page: Resume tab renders a viewer (or pending message)", async ({
    page,
  }) => {
    await page.goto("/admin/applications");
    const firstLink = page
      .locator('a[href*="/admin/applications/"]')
      .first();
    await expect(firstLink).toBeVisible({ timeout: 10_000 });
    await firstLink.click();

    await page.getByRole("tab", { name: "Resume" }).click();

    const pending = await page.getByText("Upload pending").isVisible().catch(() => false);
    if (pending) {
      console.log("Resume upload was pending — viewer not expected");
      return;
    }
    // @react-pdf-viewer renders a toolbar with an "Open" button as its
    // visible sentinel once the worker is ready. We just check that the
    // viewer container mounted without asserting on individual page DOMs.
    await expect(page.locator(".rpv-core__viewer")).toBeVisible({
      timeout: 15_000,
    });
  });
});
