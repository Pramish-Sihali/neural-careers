import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Briefcase, DollarSign, ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplicationForm } from "@/components/candidate/ApplicationForm";

interface JobDetail {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  descriptionHtml: string;
  requirements: string[];
  benefits: string[];
  publishedAt: string;
  closingDate: string | null;
  status: "OPEN" | "CLOSED" | "DRAFT";
  slug: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<JobDetail["employmentType"], string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

async function getJob(id: string): Promise<JobDetail | null> {
  const { getJobById } = await import("@/lib/repositories/jobRepo");
  const { toJobDetail } = await import("@/lib/utils/jobTransform");
  const job = await getJobById(id);
  if (!job) return null;
  return toJobDetail(job) as JobDetail;
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (!min && !max) return null;
  const sym = currency === "USD" ? "$" : (currency ?? "");
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / year`;
  if (min) return `From ${fmt(min)} / year`;
  return `Up to ${fmt(max!)} / year`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return { title: "Role not found" };
  return {
    title: `${job.title} — Niural`,
    description: `Apply for ${job.title} at Niural. ${job.location} · ${EMPLOYMENT_TYPE_LABELS[job.employmentType]}`,
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job || job.status !== "OPEN") notFound();

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const closingDate = job.closingDate
    ? new Date(job.closingDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/jobs"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All open roles
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex-1">
            {job.title}
          </h1>
          <Badge variant="secondary">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
        </div>

        <p className="text-base font-medium text-muted-foreground mb-4">{job.department}</p>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4" />
            {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
          </span>
          {salary && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              {salary}
            </span>
          )}
          {closingDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Apply by {closingDate}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          {job.descriptionHtml && (
            <section>
              <h2 className="text-xl font-semibold mb-4">About the role</h2>
              <div
                className="prose prose-sm max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
              />
            </section>
          )}

          {job.requirements.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Requirements</h2>
              <ul className="space-y-2">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                    {req}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {job.benefits.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Benefits</h2>
              <ul className="space-y-2">
                {job.benefits.map((benefit, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <div className="sticky top-8 rounded-lg border bg-card p-6 space-y-4">
            <div>
              <p className="text-sm font-medium">{job.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{job.department}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="#apply">Apply now</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/jobs">View all roles</Link>
            </Button>
          </div>
        </aside>
      </div>

      <section
        id="apply"
        aria-labelledby="apply-heading"
        className="mt-16 scroll-mt-24 rounded-lg border bg-card p-6 sm:p-10"
      >
        <header className="mb-8 border-b pb-6">
          <h2
            id="apply-heading"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            Apply for {job.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.department} · We usually reply within 5 business days.
          </p>
        </header>
        <ApplicationForm jobId={job.id} jobTitle={job.title} />
      </section>
    </main>
  );
}
