"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Sparkles, Undo2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface ApplicationFormProps {
  jobId: string;
  jobTitle: string;
}

type FormStatus =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; applicationId: string }
  | { status: "error"; message: string };

type UploadStatus =
  | { kind: "idle" }
  | { kind: "uploading" }
  | {
      kind: "ready";
      uploadId: string;
      storagePath: string;
      contentType: string;
      resumeText: string;
    }
  | {
      kind: "fallback";
      resumeText: string | null;
    };

type FieldKey = "name" | "email" | "phone";
type AutofillStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; filled: FieldKey[] }
  | { kind: "undone" };

export function ApplicationForm({ jobId, jobTitle }: ApplicationFormProps) {
  const [formState, setFormState] = useState<FormStatus>({ status: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadStatus>({ kind: "idle" });
  const [autofill, setAutofill] = useState<AutofillStatus>({ kind: "idle" });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      setUpload({ kind: "idle" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File must be 5 MB or smaller.");
      e.target.value = "";
      setUpload({ kind: "idle" });
      return;
    }
    setFileError(null);
    setUpload({ kind: "uploading" });
    setAutofill({ kind: "idle" });

    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/apply/upload-resume", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 422) {
          setFileError(body.error ?? "Resume could not be parsed.");
          setUpload({ kind: "idle" });
          return;
        }
        // For any other failure, fall back to legacy submit-time upload path.
        setUpload({ kind: "fallback", resumeText: null });
        return;
      }

      const body = (await res.json()) as {
        uploadId: string | null;
        storagePath: string | null;
        contentType: string;
        resumeText: string;
      };

      if (body.uploadId && body.storagePath) {
        setUpload({
          kind: "ready",
          uploadId: body.uploadId,
          storagePath: body.storagePath,
          contentType: body.contentType,
          resumeText: body.resumeText,
        });
        runAutofill(body.resumeText);
      } else {
        // DEV-07: storage failed but text parsed. Submit-time fallback.
        setUpload({ kind: "fallback", resumeText: body.resumeText });
        runAutofill(body.resumeText);
      }
    } catch {
      setUpload({ kind: "fallback", resumeText: null });
    }
  }

  async function runAutofill(resumeText: string) {
    setAutofill({ kind: "running" });
    try {
      const res = await fetch("/api/apply/extract-header", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      if (!res.ok) {
        setAutofill({ kind: "idle" });
        return;
      }
      const body = (await res.json()) as {
        name: string;
        email: string | null;
        phone: string | null;
      };
      const filled: FieldKey[] = [];
      if (!name && body.name) {
        setName(body.name);
        filled.push("name");
      }
      if (!email && body.email) {
        setEmail(body.email);
        filled.push("email");
      }
      if (!phone && body.phone) {
        setPhone(body.phone);
        filled.push("phone");
      }
      setAutofill({ kind: "done", filled });
    } catch {
      setAutofill({ kind: "idle" });
    }
  }

  function undoAutofill() {
    if (autofill.kind !== "done") return;
    for (const key of autofill.filled) {
      if (key === "name") setName("");
      if (key === "email") setEmail("");
      if (key === "phone") setPhone("");
    }
    setAutofill({ kind: "undone" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formState.status === "submitting") return;

    const form = e.currentTarget;

    if (upload.kind === "uploading") {
      setFileError("Please wait — your resume is still uploading.");
      return;
    }

    // Fallback (or never-uploaded) path: require a file in the input.
    const legacyFile = fileRef.current?.files?.[0];
    if (upload.kind === "idle" || upload.kind === "fallback") {
      if (!legacyFile) {
        setFileError("Please attach your resume.");
        return;
      }
      if (legacyFile.size > MAX_FILE_BYTES) {
        setFileError("File must be 5 MB or smaller.");
        return;
      }
    }

    setFormState({ status: "submitting" });

    try {
      let res: Response;
      if (upload.kind === "ready") {
        const formData = new FormData(form);
        res = await fetch("/api/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: jobId,
            name,
            email,
            phone: phone || undefined,
            yearsOfExperience: formData.get("yearsOfExperience") ?? 0,
            linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
            githubUrl: (formData.get("githubUrl") as string) || undefined,
            coverLetter: (formData.get("coverLetter") as string) || undefined,
            uploadId: upload.uploadId,
            storagePath: upload.storagePath,
            contentType: upload.contentType,
            resumeText: upload.resumeText,
          }),
        });
      } else {
        const data = new FormData(form);
        data.set("roleId", jobId);
        res = await fetch("/api/apply", { method: "POST", body: data });
      }

      const json = (await res.json()) as { applicationId?: string; error?: string };

      if (res.status === 409) {
        setFormState({
          status: "error",
          message: "You've already applied for this role.",
        });
        return;
      }
      if (res.status === 410) {
        setFormState({
          status: "error",
          message: "This role is no longer accepting applications.",
        });
        return;
      }
      if (!res.ok) {
        setFormState({
          status: "error",
          message: json.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setFormState({ status: "success", applicationId: json.applicationId! });
    } catch {
      setFormState({
        status: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  }

  if (formState.status === "success") {
    return <SuccessBanner applicationId={formState.applicationId} jobTitle={jobTitle} />;
  }

  const isSubmitting = formState.status === "submitting";
  const submitDisabled =
    isSubmitting || !!fileError || upload.kind === "uploading";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {formState.status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formState.message}
        </div>
      )}

      <FormSection
        title="Resume"
        description="Upload first — we'll pre-fill your contact details."
        fullWidth
      >
        <div className="space-y-2">
          <Label htmlFor="resume">
            Resume <span className="text-destructive">*</span>
          </Label>
          <Input
            id="resume"
            name="resume"
            type="file"
            ref={fileRef}
            accept=".pdf,.doc,.docx"
            // "required" only when we don't have a successful pre-upload
            required={upload.kind !== "ready"}
            disabled={isSubmitting}
            onChange={handleFileChange}
            className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
          <UploadIndicator upload={upload} />
          {fileError ? (
            <p className="text-xs text-destructive">{fileError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              PDF, DOC, or DOCX · max 5 MB
            </p>
          )}
          <AutofillHint autofill={autofill} onUndo={undoAutofill} />
        </div>
      </FormSection>

      <FormSection
        title="Personal information"
        description="Tell us who you are. Required fields are marked with an asterisk."
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            disabled={isSubmitting}
            placeholder="Alex Johnson"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isSubmitting}
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={isSubmitting}
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="yearsOfExperience">
            Years of experience <span className="text-destructive">*</span>
          </Label>
          <Input
            id="yearsOfExperience"
            name="yearsOfExperience"
            type="number"
            min={0}
            max={50}
            required
            disabled={isSubmitting}
            placeholder="3"
          />
        </div>
      </FormSection>

      <FormSection
        title="Links"
        description="Optional — helps us understand your work."
      >
        <div className="space-y-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            disabled={isSubmitting}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="githubUrl">GitHub username</Label>
          <Input
            id="githubUrl"
            name="githubUrl"
            type="text"
            disabled={isSubmitting}
            placeholder="your-github-handle"
          />
        </div>
      </FormSection>

      <FormSection title="Cover letter" fullWidth>
        <div className="space-y-1.5">
          <Label htmlFor="coverLetter">Tell us why you're a great fit</Label>
          <Textarea
            id="coverLetter"
            name="coverLetter"
            rows={5}
            disabled={isSubmitting}
            placeholder="What draws you to this role? Share any recent work you're proud of."
            className="resize-y"
          />
        </div>
      </FormSection>

      <div className="flex flex-col items-start gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By submitting this form you agree to our privacy policy.
        </p>
        <Button
          type="submit"
          disabled={submitDisabled}
          className="w-full sm:w-auto"
          size="lg"
        >
          {isSubmitting ? "Submitting…" : "Submit application"}
        </Button>
      </div>
    </form>
  );
}

function UploadIndicator({ upload }: { upload: UploadStatus }) {
  if (upload.kind === "uploading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Uploading resume…
      </p>
    );
  }
  if (upload.kind === "ready") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Resume uploaded — submit will be instant.
      </p>
    );
  }
  if (upload.kind === "fallback") {
    return (
      <p className="text-xs text-muted-foreground">
        Resume parsed — will upload when you submit.
      </p>
    );
  }
  return null;
}

function AutofillHint({
  autofill,
  onUndo,
}: {
  autofill: AutofillStatus;
  onUndo: () => void;
}) {
  if (autofill.kind === "running") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Extracting contact details…
      </p>
    );
  }
  if (autofill.kind === "done" && autofill.filled.length > 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI filled {autofill.filled.length} field
        {autofill.filled.length === 1 ? "" : "s"}.
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      </p>
    );
  }
  return null;
}

function FormSection({
  title,
  description,
  fullWidth,
  children,
}: {
  title: string;
  description?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      <div className={fullWidth ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        {children}
      </div>
    </section>
  );
}

function SuccessBanner({
  applicationId,
  jobTitle,
}: {
  applicationId: string;
  jobTitle: string;
}) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
        <svg
          className="h-6 w-6 text-green-600 dark:text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mb-1 text-lg font-semibold text-green-900 dark:text-green-100">
        Application submitted!
      </h2>
      <p className="mb-4 text-sm text-green-700 dark:text-green-300">
        We&apos;ve received your application for <strong>{jobTitle}</strong>. Check
        your inbox for a confirmation email.
      </p>
      <p className="text-xs text-green-600 dark:text-green-400">
        Application ID: <span className="font-mono">{applicationId}</span>
      </p>
    </div>
  );
}
