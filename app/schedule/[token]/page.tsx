import { notFound } from "next/navigation";
import { verifyScheduleToken } from "@/lib/auth/scheduleToken";
import { prisma } from "@/lib/prisma";
import { SlotPicker } from "./SlotPicker";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SchedulePage({ params }: Props) {
  const { token } = await params;

  let applicationId: string;
  try {
    applicationId = await verifyScheduleToken(token);
  } catch {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-semibold">Link expired or invalid</h1>
          <p className="text-sm text-muted-foreground">
            This scheduling link has expired or is no longer valid. Please contact
            your recruiter for a new link.
          </p>
        </div>
      </main>
    );
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      interviewSlots: {
        where: { status: "HELD" },
        orderBy: { startTime: "asc" },
      },
    },
  });

  if (!application) notFound();

  // Already confirmed — show status
  if (application.status === "INTERVIEWING") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-3">
          <div className="text-4xl">✓</div>
          <h1 className="text-xl font-semibold">Interview already scheduled</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve already selected an interview slot. Check your email for
            confirmation details.
          </p>
        </div>
      </main>
    );
  }

  const slots = application.interviewSlots;

  if (slots.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-semibold">No slots available</h1>
          <p className="text-sm text-muted-foreground">
            All available slots have expired. Please contact your recruiter.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Choose your interview time</h1>
          <p className="text-muted-foreground text-sm">
            {application.candidateName} · {application.job.title}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Select one of the available slots below. You&apos;ll receive a
            confirmation email with a meeting link once you book.
          </p>
        </div>

        <SlotPicker
          slots={slots.map((s) => ({
            id: s.id,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
          }))}
          token={token}
        />
      </div>
    </main>
  );
}
