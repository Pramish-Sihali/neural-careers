export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import { AdminPipelineClient } from "@/components/admin/AdminPipelineClient";
import type { NewApplicationRow } from "@/components/admin/NewApplicationsTable";
import type { PipelineRow } from "@/components/admin/PipelineTable";
import type {
  ActivityRow,
  ActivityStatus,
} from "@/components/admin/InterviewActivityTable";
import { CreateJobButton } from "@/components/admin/CreateJobButton";

interface OfferLite {
  applicationId: string;
  status: string;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

interface InterviewLite {
  applicationId: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
}

interface SlotLite {
  applicationId: string;
  status: string;
  startTime: string;
}

async function getData(searchParams: Record<string, string>) {
  const [appsResult, slotsResult, offersResult, interviewsResult, calendarCreds] =
    await Promise.all([
      supabase
        .from("applications")
        .select("*, job:jobs(*)")
        .order("createdAt", { ascending: false }),
      supabase
        .from("interview_slots")
        .select("applicationId, status, startTime")
        .order("startTime", { ascending: true }),
      supabase
        .from("offers")
        .select("applicationId, status, sentAt, signedAt, createdAt")
        .order("createdAt", { ascending: false }),
      supabase
        .from("interviews")
        .select("applicationId, status, scheduledAt, completedAt"),
      process.env.USE_MOCK_CALENDAR !== "true"
        ? supabase
            .from("interviewer_credentials")
            .select("interviewerEmail")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  const applications = (appsResult.data ?? []).map((row) =>
    parseApplicationRow(row as Record<string, unknown>)
  );
  const slots = (slotsResult.data ?? []) as SlotLite[];
  const offers = (offersResult.data ?? []) as OfferLite[];
  const interviews = (interviewsResult.data ?? []) as InterviewLite[];

  // Index by applicationId for cheap lookups. The offer query is already
  // sorted by createdAt DESC, so first() yields the latest offer per app.
  const latestOfferByApp = new Map<string, OfferLite>();
  for (const o of offers) {
    if (!latestOfferByApp.has(o.applicationId)) latestOfferByApp.set(o.applicationId, o);
  }
  const interviewByApp = new Map<string, InterviewLite>();
  for (const i of interviews) interviewByApp.set(i.applicationId, i);

  const slotsByApp = new Map<string, SlotLite[]>();
  for (const s of slots) {
    const list = slotsByApp.get(s.applicationId) ?? [];
    list.push(s);
    slotsByApp.set(s.applicationId, list);
  }

  const newApps: NewApplicationRow[] = applications
    .filter((a) => a.status === "APPLIED")
    .map((a) => ({
      id: a.id,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      jobTitle: a.job!.title,
      createdAt: a.createdAt.toISOString(),
    }));

  const pipeline: PipelineRow[] = applications
    .filter((a) => a.status !== "APPLIED")
    .map((a) => ({
      id: a.id,
      candidateName: a.candidateName,
      candidateEmail: a.candidateEmail,
      status: a.status,
      fitScore: a.fitScore,
      jobTitle: a.job!.title,
      createdAt: a.createdAt.toISOString(),
    }));

  // Activity rows — collapsed status view ordered most-recent-first.
  const ACTIVITY_STATUSES: ActivityStatus[] = [
    "Offer signed",
    "Offer sent",
    "Awaiting notes",
    "Scheduled",
    "Awaiting confirmation",
    "Onboarded",
  ];

  const rowsPool: ActivityRow[] = applications
    .map((a): ActivityRow | null => {
      const offer = latestOfferByApp.get(a.id);
      const interview = interviewByApp.get(a.id);
      const appSlots = slotsByApp.get(a.id) ?? [];
      const confirmedSlot = appSlots.find((s) => s.status === "CONFIRMED");
      const heldSlots = appSlots.filter((s) => s.status === "HELD");

      const base = {
        applicationId: a.id,
        candidateName: a.candidateName,
        jobTitle: a.job!.title,
      };

      if (a.status === "ONBOARDED") {
        return {
          ...base,
          time: offer?.signedAt ?? null,
          status: "Onboarded",
        };
      }
      if (a.status === "OFFER_SIGNED" || offer?.status === "SIGNED") {
        return {
          ...base,
          time: offer?.signedAt ?? null,
          status: "Offer signed",
        };
      }
      if (a.status === "OFFER_SENT" || offer?.status === "SENT") {
        return {
          ...base,
          time: offer?.sentAt ?? null,
          status: "Offer sent",
        };
      }
      if (a.status === "POST_INTERVIEW") {
        return {
          ...base,
          time: interview?.completedAt ?? null,
          status: "Awaiting notes",
        };
      }
      if (a.status === "INTERVIEWING" || confirmedSlot) {
        return {
          ...base,
          time: confirmedSlot?.startTime ?? null,
          status: "Scheduled",
        };
      }
      if (a.status === "SHORTLISTED" && heldSlots.length > 0) {
        return {
          ...base,
          time: heldSlots[0].startTime,
          status: "Awaiting confirmation",
        };
      }
      return null;
    })
    .filter((r): r is ActivityRow => r !== null);

  const activityRows = rowsPool.sort((a, b) => {
    const sa = ACTIVITY_STATUSES.indexOf(a.status);
    const sb = ACTIVITY_STATUSES.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return (b.time ?? "").localeCompare(a.time ?? "");
  });

  const authStatus = searchParams.calendar_auth as string | undefined;
  const calendarConnected = !!(calendarCreds as { data: unknown }).data;

  return { newApps, pipeline, activityRows, calendarConnected, authStatus };
}

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function AdminApplicationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { newApps, pipeline, activityRows, calendarConnected, authStatus } =
    await getData(sp);

  const useMock = process.env.USE_MOCK_CALENDAR === "true";
  const totalApps = newApps.length + pipeline.length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      {!useMock && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            calendarConnected
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          <span>
            {authStatus === "success" && "✓ Google Calendar connected successfully. "}
            {authStatus === "error" && "⚠ Google auth failed — please try again. "}
            {authStatus === "denied" && "⚠ Google auth was cancelled. "}
            {calendarConnected
              ? "Google Calendar is connected — real slots and Meet links are active."
              : "Google Calendar is not connected. Interview slots will fail until you connect."}
          </span>
          {!calendarConnected && (
            <a
              href={`/api/auth/google?authorization=Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`}
              className="ml-4 rounded-md bg-yellow-700 px-3 py-1.5 text-xs text-white hover:bg-yellow-800 whitespace-nowrap"
            >
              Connect Google Calendar →
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalApps} total application{totalApps !== 1 ? "s" : ""} in the pipeline.
          </p>
        </div>
        <CreateJobButton />
      </div>

      <AdminPipelineClient
        initialNewApps={newApps}
        initialPipeline={pipeline}
        activityRows={activityRows}
      />
    </main>
  );
}
