"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export function GenerateOfferButton({ applicationId, candidateName, jobTitle }: Props) {
  const router = useRouter();
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  const [open, setOpen] = useState(false);
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

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setError(null);
    const salary = parseInt(form.baseSalary, 10);
    if (!form.jobTitle.trim()) return setError("Job title is required");
    if (!form.startDate) return setError("Start date is required");
    if (!salary || salary < 1) return setError("Base salary must be a positive number");
    if (!form.compensationStructure.trim()) return setError("Compensation structure is required");
    if (!form.reportingManager.trim()) return setError("Reporting manager is required");

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

      // Stream the response to drain it — we get the offer ID from the header
      const offerId = res.headers.get("X-Offer-Id");
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      if (!offerId) throw new Error("Missing X-Offer-Id header");
      setOpen(false);
      router.push(`/admin/offers/${offerId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate offer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Generate offer letter
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Offer details for {candidateName}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Gemini will draft a letter from these inputs. You can edit before sending.
              </p>
            </div>

            <div className="space-y-4 p-6">
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
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Generating..." : "Generate letter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-md border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
