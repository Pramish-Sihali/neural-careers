"use client";

export interface ActivitySlot {
  id: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface ApplicationGroup {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  slots: ActivitySlot[];
}

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800 border border-green-200",
  HELD:      "bg-yellow-100 text-yellow-800 border border-yellow-200",
  RELEASED:  "bg-gray-100 text-gray-500 border border-gray-200",
  EXPIRED:   "bg-gray-100 text-gray-400 border border-gray-200",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "numeric",
    minute:  "2-digit",
    hour12:  true,
  });
}

function groupByApplication(slots: ActivitySlot[]): ApplicationGroup[] {
  const map = new Map<string, ApplicationGroup>();
  for (const slot of slots) {
    if (!map.has(slot.applicationId)) {
      map.set(slot.applicationId, {
        applicationId: slot.applicationId,
        candidateName: slot.candidateName,
        jobTitle:      slot.jobTitle,
        slots:         [],
      });
    }
    map.get(slot.applicationId)!.slots.push(slot);
  }
  // Sort each group: CONFIRMED first, then by startTime
  for (const group of map.values()) {
    group.slots.sort((a, b) => {
      if (a.status === "CONFIRMED" && b.status !== "CONFIRMED") return -1;
      if (b.status === "CONFIRMED" && a.status !== "CONFIRMED") return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }
  // Sort groups: those with a CONFIRMED slot first
  return [...map.values()].sort((a, b) => {
    const aConfirmed = a.slots.some((s) => s.status === "CONFIRMED");
    const bConfirmed = b.slots.some((s) => s.status === "CONFIRMED");
    if (aConfirmed && !bConfirmed) return -1;
    if (bConfirmed && !aConfirmed) return 1;
    return 0;
  });
}

function groupSummary(group: ApplicationGroup): string {
  const confirmed = group.slots.find((s) => s.status === "CONFIRMED");
  if (confirmed) return "Interview scheduled";
  const active = group.slots.filter((s) => s.status === "HELD");
  if (active.length > 0) return `Awaiting candidate reply — ${active.length} slot${active.length !== 1 ? "s" : ""} offered`;
  return "Slots expired or released";
}

export function InterviewActivityFeed({ slots }: { slots: ActivitySlot[] }) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-muted-foreground">
        No interview slots have been offered yet.
      </div>
    );
  }

  const groups = groupByApplication(slots);

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const confirmed = group.slots.find((s) => s.status === "CONFIRMED");
        const isWaiting = !confirmed && group.slots.some((s) => s.status === "HELD");

        return (
          <div
            key={group.applicationId}
            className={`rounded-lg border px-4 py-4 space-y-3 ${
              confirmed
                ? "border-green-200 bg-green-50"
                : isWaiting
                ? "border-yellow-200 bg-yellow-50"
                : "border-gray-200 bg-white"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sm text-gray-900">{group.candidateName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{group.jobTitle}</p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  confirmed
                    ? "bg-green-100 text-green-800"
                    : isWaiting
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {groupSummary(group)}
              </span>
            </div>

            {/* Confirmed slot highlighted */}
            {confirmed && (
              <div className="rounded-md bg-green-100 border border-green-200 px-3 py-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">
                  Confirmed
                </p>
                <p className="text-sm text-green-900 font-medium">{fmt(confirmed.startTime)}</p>
              </div>
            )}

            {/* All slot pills */}
            <div className="flex flex-wrap gap-2">
              {group.slots.map((slot) => (
                <span
                  key={slot.id}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[slot.status] ?? STATUS_PILL.EXPIRED}`}
                >
                  {fmt(slot.startTime)}
                  {slot.status === "CONFIRMED" && " ✓"}
                  {slot.status === "HELD" && " · waiting"}
                  {slot.status === "RELEASED" && " · released"}
                  {slot.status === "EXPIRED" && " · expired"}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
