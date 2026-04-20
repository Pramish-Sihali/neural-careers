import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApplicationForm } from "@/components/candidate/ApplicationForm";

interface JobMeta {
  id: string;
  title: string;
  department: string;
  status: "OPEN" | "CLOSED" | "DRAFT";
}

async function getJobMeta(id: string): Promise<JobMeta | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/${id}`,
    { next: { revalidate: 60 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<JobMeta>;
}

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { jobId } = await params;
  const job = await getJobMeta(jobId);
  if (!job) return { title: "Role not found" };
  return { title: `Apply — ${job.title} · Niural` };
}

export default async function ApplyPage({ params }: PageProps) {
  const { jobId } = await params;
  const job = await getJobMeta(jobId);

  if (!job || job.status !== "OPEN") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={`/jobs/${job.id}`}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to role
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Apply for {job.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{job.department}</p>
      </div>

      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <ApplicationForm jobId={job.id} jobTitle={job.title} />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By submitting this form you agree to our{" "}
        <Link href="#" className="underline underline-offset-2 hover:text-foreground">
          privacy policy
        </Link>
        .
      </p>
    </main>
  );
}
