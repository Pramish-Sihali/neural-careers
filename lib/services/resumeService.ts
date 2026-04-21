import { createClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import { resolve } from "path";
import { pathToFileURL } from "url";

// Configure unpdf once per process with a Node.js-compatible pdfjs-dist build.
// The default unpdf/pdfjs bundle is browser-only and crashes in Next.js API routes.
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

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_TEXT_LENGTH = 100;

export class ResumeParseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TOO_LARGE"
      | "INVALID_TYPE"
      | "PARSE_FAILED"
      | "TOO_SHORT"
  ) {
    super(message);
    this.name = "ResumeParseError";
  }
}

export async function parseResumeBuffer(
  buffer: Buffer,
  originalName: string
): Promise<string> {
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    throw new ResumeParseError("File exceeds 5 MB limit", "TOO_LARGE");
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime ?? "";

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new ResumeParseError(
      `Unsupported file type: ${mime || "unknown"}`,
      "INVALID_TYPE"
    );
  }

  let text: string;

  if (mime === "application/pdf") {
    await ensureUnpdfConfigured();
    const { extractText } = await import("unpdf");
    const { text: extracted } = await extractText(new Uint8Array(buffer), { mergePages: true });
    text = extracted;
  } else {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length < MIN_TEXT_LENGTH) {
    throw new ResumeParseError(
      "Resume contains too little text — may be image-only",
      "TOO_SHORT"
    );
  }

  return cleaned;
}

export async function uploadResume(
  buffer: Buffer,
  applicationId: string,
  mimeType: string
): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = mimeType.includes("pdf") ? "pdf" : "docx";
  const path = `resumes/${applicationId}.${ext}`;

  const { error } = await supabase.storage
    .from("resumes")
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return path;
}
