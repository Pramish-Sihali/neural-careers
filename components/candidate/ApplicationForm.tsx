"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB client-side guard

interface ApplicationFormProps {
  jobId: string;
  jobTitle: string;
}

interface SuccessState {
  applicationId: string;
}

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; applicationId: string }
  | { status: "error"; message: string };

export function ApplicationForm({ jobId, jobTitle }: ApplicationFormProps) {
  const [formState, setFormState] = useState<FormState>({ status: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File must be 5 MB or smaller.");
      e.target.value = "";
    } else {
      setFileError(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formState.status === "submitting") return;

    const form = e.currentTarget;
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setFileError("Please attach your resume.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File must be 5 MB or smaller.");
      return;
    }

    const data = new FormData(form);
    data.set("roleId", jobId);

    setFormState({ status: "submitting" });

    try {
      const res = await fetch("/api/apply", { method: "POST", body: data });
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formState.status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formState.message}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="coverLetter">Cover letter</Label>
        <Textarea
          id="coverLetter"
          name="coverLetter"
          rows={5}
          disabled={isSubmitting}
          placeholder="Tell us why you're a great fit for this role…"
          className="resize-y"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resume">
          Resume <span className="text-destructive">*</span>
        </Label>
        <Input
          id="resume"
          name="resume"
          type="file"
          ref={fileRef}
          accept=".pdf,.doc,.docx"
          required
          disabled={isSubmitting}
          onChange={handleFileChange}
          className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
        />
        {fileError ? (
          <p className="text-xs text-destructive">{fileError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            PDF, DOC, or DOCX · max 5 MB
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !!fileError}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}

function SuccessBanner({
  applicationId,
  jobTitle,
}: SuccessState & { jobTitle: string }) {
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
