"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Props {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
}

interface FormState {
  jobTitle: string;
  startDate: string;
  baseSalary: string;
  compensationStructure: string;
  equity: string;
  bonus: string;
  reportingManager: string;
  customTerms: string;
}

export function SendOfferAccordion({
  applicationId,
  candidateName,
  jobTitle,
}: Props) {
  const router = useRouter();
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    jobTitle,
    startDate: defaultStartDate(),
    baseSalary: "",
    compensationStructure: "Annual salary, paid bi-weekly",
    equity: "",
    bonus: "",
    reportingManager: "",
    customTerms: "",
  });

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setError(null);
    const salary = parseInt(form.baseSalary, 10);
    if (!form.jobTitle.trim()) return setError("Job title is required");
    if (!form.startDate) return setError("Start date is required");
    if (!salary || salary < 1) return setError("Base salary must be a positive number");
    if (!form.compensationStructure.trim())
      return setError("Compensation structure is required");
    if (!form.reportingManager.trim())
      return setError("Reporting manager is required");

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({
          applicationId,
          jobTitle: form.jobTitle.trim(),
          startDate: form.startDate,
          baseSalary: salary,
          compensationStructure: form.compensationStructure.trim(),
          equity: form.equity.trim() || null,
          bonus: form.bonus.trim() || null,
          reportingManager: form.reportingManager.trim(),
          customTerms: form.customTerms.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const offerId = res.headers.get("X-Offer-Id");
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      if (!offerId) throw new Error("Missing X-Offer-Id header");
      router.push(`/admin/offers/${offerId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate offer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="send-offer" className="rounded-lg border bg-card px-4">
        <AccordionTrigger className="py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            Generate offer letter
            <span className="text-xs font-normal text-muted-foreground">
              for {candidateName}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 pt-2">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Gemini will draft a letter from these inputs. You can edit it on
              the next screen before sending.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => update("jobTitle", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Base salary (USD)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.baseSalary}
                  onChange={(e) => update("baseSalary", e.target.value)}
                  placeholder="120000"
                  className={inputClass}
                />
              </Field>
              <Field label="Compensation structure">
                <input
                  type="text"
                  value={form.compensationStructure}
                  onChange={(e) => update("compensationStructure", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Equity (optional)">
                <input
                  type="text"
                  value={form.equity}
                  onChange={(e) => update("equity", e.target.value)}
                  placeholder="0.15% over 4 years, 1yr cliff"
                  className={inputClass}
                />
              </Field>
              <Field label="Bonus (optional)">
                <input
                  type="text"
                  value={form.bonus}
                  onChange={(e) => update("bonus", e.target.value)}
                  placeholder="10% annual target"
                  className={inputClass}
                />
              </Field>
              <Field label="Reporting manager">
                <input
                  type="text"
                  value={form.reportingManager}
                  onChange={(e) => update("reportingManager", e.target.value)}
                  placeholder="Jane Smith, VP Engineering"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Custom terms (optional)">
              <textarea
                value={form.customTerms}
                onChange={(e) => update("customTerms", e.target.value)}
                rows={3}
                placeholder="Relocation assistance up to $10,000..."
                className={`${inputClass} resize-y`}
              />
            </Field>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Generating…" : "Generate letter"}
              </button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
