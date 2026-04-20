import { prisma } from "@/lib/prisma";
import { fetchGitHubDigest } from "@/lib/integrations/enrichment/github";
import { searchLinkedIn, searchCandidate } from "@/lib/integrations/enrichment/tavily";
import { synthesizeResearch } from "@/lib/ai/prompts/synthesizeResearch";

export async function enrichCandidate(applicationId: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidateName: true,
      linkedinUrl: true,
      githubUrl: true,
      resumeText: true,
    },
  });

  if (!application) throw new Error(`Application ${applicationId} not found`);

  const [linkedinSummary, githubDigest, webSearch] = await Promise.allSettled([
    searchLinkedIn(application.candidateName),
    application.githubUrl
      ? fetchGitHubDigest(extractGitHubUsername(application.githubUrl))
      : Promise.resolve(null),
    searchCandidate(application.candidateName, "software engineer developer"),
  ]);

  const onlineData = {
    linkedinSummary:
      linkedinSummary.status === "fulfilled" ? linkedinSummary.value : undefined,
    githubDigest:
      githubDigest.status === "fulfilled" && githubDigest.value
        ? githubDigest.value
        : undefined,
    webSearch:
      webSearch.status === "fulfilled" ? webSearch.value : undefined,
  };

  const synthesis = await synthesizeResearch(application.resumeText, onlineData);

  await prisma.candidateEnrichment.upsert({
    where: { applicationId },
    create: {
      applicationId,
      linkedinUrl: application.linkedinUrl,
      linkedinSummary: onlineData.linkedinSummary,
      githubUsername:
        githubDigest.status === "fulfilled" && githubDigest.value
          ? githubDigest.value.username
          : undefined,
      githubDigest: onlineData.githubDigest ? JSON.parse(JSON.stringify(onlineData.githubDigest)) : undefined,
      candidateBrief: synthesis.candidateBrief,
      discrepancies: synthesis.discrepancies,
      enrichedAt: new Date(),
    },
    update: {
      linkedinSummary: onlineData.linkedinSummary,
      githubDigest: onlineData.githubDigest ? JSON.parse(JSON.stringify(onlineData.githubDigest)) : undefined,
      candidateBrief: synthesis.candidateBrief,
      discrepancies: synthesis.discrepancies,
      enrichedAt: new Date(),
    },
  });
}

function extractGitHubUsername(url: string): string {
  const match = url.match(/github\.com\/([^/?#]+)/);
  return match?.[1] ?? url;
}
