import type { ApplicationStatus } from "@/lib/types/database";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  APPLIED:        { label: "Applied",        className: "bg-gray-100 text-gray-700" },
  SCREENED:       { label: "Screened",       className: "bg-blue-100 text-blue-700" },
  SHORTLISTED:    { label: "Shortlisted",    className: "bg-purple-100 text-purple-700" },
  INTERVIEWING:   { label: "Interviewing",   className: "bg-yellow-100 text-yellow-700" },
  POST_INTERVIEW: { label: "Post-Interview", className: "bg-orange-100 text-orange-700" },
  OFFER_SENT:     { label: "Offer Sent",     className: "bg-indigo-100 text-indigo-700" },
  OFFER_SIGNED:   { label: "Offer Signed",   className: "bg-teal-100 text-teal-700" },
  ONBOARDED:      { label: "Onboarded",      className: "bg-green-100 text-green-700" },
  REJECTED:       { label: "Rejected",       className: "bg-red-100 text-red-700" },
  WITHDRAWN:      { label: "Withdrawn",      className: "bg-zinc-100 text-zinc-500" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
