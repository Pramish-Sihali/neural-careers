import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function ApplyRedirectPage({ params }: PageProps) {
  const { jobId } = await params;
  redirect(`/jobs/${jobId}#apply`);
}
