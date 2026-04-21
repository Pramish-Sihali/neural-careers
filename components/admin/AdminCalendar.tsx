"use client";

import { useState } from "react";

export interface CalendarSlot {
  id: string;
  candidateName: string;
  jobTitle: string;
  startTime: string;
  endTime: string;
  status: string;
}

type View = "month" | "week" | "year";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SLOT_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800 border-green-200",
  HELD:      "bg-blue-100 text-blue-800 border-blue-200",
  RELEASED:  "bg-gray-100 text-gray-500 border-gray-200",
  EXPIRED:   "bg-gray-100 text-gray-400 border-gray-200",
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function buildMonthCells(year: number, month: number): (Date | null)[] {
  const cells: (Date | null)[] = [];
  const pad = firstDayOfMonth(year, month);
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function AdminCalendar({ slots }: { slots: CalendarSlot[] }) {
  const today = new Date();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const parsed = slots.map((s) => ({ ...s, start: new Date(s.startTime), end: new Date(s.endTime) }));

  function navigate(dir: number) {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    } else if (view === "week") {
      const d = new Date(cursor);
      d.setDate(d.getDate() + dir * 7);
      setCursor(d);
    } else {
      setCursor(new Date(cursor.getFullYear() + dir, 0, 1));
    }
  }

  function title() {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = weekStart(cursor);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `${SHORT_MONTHS[ws.getMonth()]} ${ws.getDate()} – ${SHORT_MONTHS[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
    }
    return String(cursor.getFullYear());
  }

  // ── Month view ────────────────────────────────────────────────────────────
  const monthCells = view === "month"
    ? buildMonthCells(cursor.getFullYear(), cursor.getMonth())
    : [];

  // ── Week view ─────────────────────────────────────────────────────────────
  const ws = weekStart(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 am – 6 pm

  // flat list of cells for week grid: [label, day0, day1, …day6] × 11 rows
  const weekCells: React.ReactNode[] = [];
  for (const hour of hours) {
    const label = `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;
    weekCells.push(
      <div key={`lbl-${hour}`} className="bg-background px-2 py-2 text-xs text-muted-foreground text-right border-t border-border">
        {label}
      </div>
    );
    for (const day of weekDays) {
      const cell = parsed.filter((s) => isSameDay(s.start, day) && s.start.getHours() === hour);
      weekCells.push(
        <div key={`${day.toDateString()}-${hour}`} className="bg-background border-t border-l border-border min-h-[44px] p-1">
          {cell.map((s) => (
            <div
              key={s.id}
              title={`${s.candidateName} — ${s.jobTitle}\n${fmtTime(s.start)} – ${fmtTime(s.end)}`}
              className={`rounded px-1 py-0.5 text-[10px] truncate border mb-0.5 ${SLOT_COLORS[s.status] ?? "bg-gray-100"}`}
            >
              {s.candidateName.split(" ")[0]} — {s.jobTitle}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          >
            ‹
          </button>
          <span className="text-sm font-medium min-w-[200px] text-center">{title()}</span>
          <button
            onClick={() => navigate(1)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          >
            ›
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted ml-1"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["month", "week", "year"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Month ── */}
      {view === "month" && (
        <div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
            {monthCells.map((date, i) => {
              const daySlots = date ? parsed.filter((s) => isSameDay(s.start, date)) : [];
              const isToday = date ? isSameDay(date, today) : false;
              return (
                <div key={i} className="bg-background min-h-[80px] p-1.5">
                  {date && (
                    <>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {daySlots.slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          title={`${s.candidateName} — ${s.jobTitle}\n${fmtTime(s.start)} – ${fmtTime(s.end)}`}
                          className={`rounded px-1 py-0.5 text-[10px] truncate border mb-0.5 ${
                            SLOT_COLORS[s.status] ?? "bg-gray-100"
                          }`}
                        >
                          {fmtTime(s.start)} {s.candidateName.split(" ")[0]}
                        </div>
                      ))}
                      {daySlots.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{daySlots.length - 2} more
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week ── */}
      {view === "week" && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-8 gap-px mb-1">
              <div />
              {weekDays.map((d) => (
                <div key={d.toISOString()} className="text-center py-2">
                  <div className="text-xs font-medium text-muted-foreground">{DAYS[d.getDay()]}</div>
                  <div
                    className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isSameDay(d, today)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-8 rounded-md border overflow-hidden">
              {weekCells}
            </div>
          </div>
        </div>
      )}

      {/* ── Year ── */}
      {view === "year" && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => {
            const cells = buildMonthCells(cursor.getFullYear(), m);
            return (
              <div key={m}>
                <p className="text-xs font-semibold text-center mb-2 text-muted-foreground">
                  {SHORT_MONTHS[m]}
                </p>
                <div className="grid grid-cols-7 gap-px">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[9px] text-muted-foreground pb-0.5">
                      {d[0]}
                    </div>
                  ))}
                  {cells.map((date, i) => {
                    const hasSlot = date
                      ? parsed.some((s) => isSameDay(s.start, date))
                      : false;
                    const isToday = date ? isSameDay(date, today) : false;
                    return (
                      <div key={i} className="flex items-center justify-center">
                        {date && (
                          <span
                            className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${
                              isToday
                                ? "bg-primary text-primary-foreground font-semibold"
                                : hasSlot
                                ? "bg-blue-100 text-blue-700 font-semibold"
                                : "text-foreground"
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {Object.entries(SLOT_COLORS).map(([status, cls]) => (
          <span key={status} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] border ${cls}`}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        ))}
        {slots.length === 0 && (
          <span className="text-xs text-muted-foreground">
            No interviews scheduled yet — slots will appear once Calendar Orchestration (Phase 03) is active.
          </span>
        )}
      </div>
    </div>
  );
}
