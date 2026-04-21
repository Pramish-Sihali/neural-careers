"use client";

import { useEffect, useRef, useState } from "react";

interface SlotItem {
  start: string;
  end: string;
  pendingThisApp: boolean;
}

interface Props {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
  onOffered: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDatePill(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isoDateKey(iso: string): string {
  // Returns "YYYY-MM-DD" in local time
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SlotPickerModal({ applicationId, candidateName, onClose, onOffered }: Props) {
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch available slots
  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/admin/applications/${applicationId}/available-slots`,
          { headers: { Authorization: `Bearer ${adminSecret}` } }
        );
        const json = await res.json() as { slots?: SlotItem[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load slots");
        const fetchedSlots = json.slots ?? [];
        setSlots(fetchedSlots);
        // Default-select the first date
        if (fetchedSlots.length > 0) {
          setSelectedDate(isoDateKey(fetchedSlots[0].start));
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    }
    void fetchSlots();
  }, [applicationId, adminSecret]);

  // Group by date
  const dateGroups = slots.reduce<Record<string, SlotItem[]>>((acc, s) => {
    const key = isoDateKey(s.start);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(dateGroups).sort();
  const activeDateSlots = selectedDate ? (dateGroups[selectedDate] ?? []) : [];

  function toggleSlot(start: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(start)) {
        next.delete(start);
      } else {
        if (next.size < 5) next.add(start);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const chosenSlots = slots
        .filter((s) => selected.has(s.start))
        .map((s) => ({ start: s.start, end: s.end }));

      const res = await fetch(`/api/admin/applications/${applicationId}/offer-slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ slots: chosenSlots }),
      });

      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to send offer");

      onOffered();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Modal panel */}
      <div
        className="relative w-full max-w-lg rounded-xl border bg-white shadow-2xl flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-picker-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h2 id="slot-picker-title" className="text-lg font-semibold leading-tight">
              Offer Interview Slots
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select 1–5 slots to offer to{" "}
              <span className="font-medium text-gray-700">{candidateName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="ml-2 text-sm text-gray-500">Loading available slots…</span>
            </div>
          )}

          {!loading && fetchError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && slots.length === 0 && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              No available slots found in the next two weeks.
            </div>
          )}

          {!loading && !fetchError && slots.length > 0 && (
            <div className="space-y-4">
              {/* Date pills */}
              <div className="flex flex-wrap gap-2">
                {sortedDates.map((dateKey) => {
                  const firstSlot = dateGroups[dateKey][0];
                  const isActive = selectedDate === dateKey;
                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDate(dateKey)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                      }`}
                    >
                      {formatDatePill(firstSlot.start)}
                    </button>
                  );
                })}
              </div>

              {/* Slot cards for selected date */}
              {selectedDate && (
                <div className="grid grid-cols-1 gap-2">
                  {activeDateSlots.map((slot) => {
                    const isPending = slot.pendingThisApp;
                    const isSelected = selected.has(slot.start);
                    const timeRange = `${formatTime(slot.start)} – ${formatTime(slot.end)}`;

                    if (isPending) {
                      return (
                        <div
                          key={slot.start}
                          className="flex items-center justify-between rounded-lg px-4 py-3 bg-yellow-100 text-yellow-800 border border-yellow-200"
                        >
                          <span className="text-sm font-medium">{timeRange}</span>
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            Awaiting response
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot.start}
                        onClick={() => toggleSlot(slot.start)}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 border text-left transition-all ${
                          isSelected
                            ? "bg-blue-100 text-blue-800 border-blue-200 ring-2 ring-blue-400"
                            : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <span className="text-sm font-medium">{timeRange}</span>
                        {isSelected && (
                          <svg className="h-4 w-4 text-blue-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selected.size > 0 && (
                <p className="text-xs text-gray-500">
                  {selected.size} slot{selected.size !== 1 ? "s" : ""} selected (max 5)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex flex-col gap-2">
          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0 || submitting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50 transition-colors min-w-[100px]"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5 justify-center">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Sending…
                </span>
              ) : (
                "Send Offer"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
