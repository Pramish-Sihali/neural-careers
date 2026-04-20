import { createClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    text = result.text;
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
