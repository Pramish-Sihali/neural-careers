"use client";

import { useState } from "react";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
}

interface Props {
  slots: Slot[];
  token: string;
}

function fmtSlot(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return { date, time: `${startTime} – ${endTime}` };
}

export function SlotPicker({ slots, token }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(slotId: string) {
    setConfirming(slotId);
    setError(null);
    try {
      const res = await fetch("/api/schedule/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slotId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to confirm");
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(null);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-green-800 mb-2">Interview confirmed!</h2>
        <p className="text-green-700 text-sm">
          You&apos;ll receive a confirmation email with meeting details shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {slots.map((slot) => {
        const { date, time } = fmtSlot(slot.startTime, slot.endTime);
        const isLoading = confirming === slot.id;
        return (
          <div
            key={slot.id}
            className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-muted/30 transition-colors"
          >
            <div>
              <p className="font-medium text-sm">{date}</p>
              <p className="text-sm text-muted-foreground">{time}</p>
            </div>
            <button
              onClick={() => handleConfirm(slot.id)}
              disabled={confirming !== null}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {isLoading ? "Confirming…" : "Book this slot"}
            </button>
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
