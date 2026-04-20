import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "@/components/candidate/JobCard";
import { listActiveJobs } from "@/lib/repositories/jobRepo";
import { toJobSummary } from "@/lib/utils/jobTransform";

async function getJobs() {
  const jobs = await listActiveJobs();
  return jobs.map(toJobSummary);
}

function JobCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}

function JobListSkeletons() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

async function JobList() {
  const jobs = await getJobs();

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <p className="text-lg font-medium text-foreground">No open roles right now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon — we&apos;re growing fast.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          id={job.id}
          title={job.title}
          department={job.department}
          location={job.location}
          employmentType={job.employmentType}
          salaryMin={job.salaryMin}
          salaryMax={job.salaryMax}
          salaryCurrency={job.salaryCurrency}
        />
      ))}
    </div>
  );
}

export const metadata = {
  title: "Open Roles — Niural",
  description: "Explore open positions and join our team.",
};

export default function JobsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Open roles
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Find your next opportunity and help us build something great.
        </p>
      </div>

      <Suspense fallback={<JobListSkeletons />}>
        <JobList />
      </Suspense>
    </main>
  );
}
