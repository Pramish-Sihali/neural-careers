import { supabase } from "@/lib/supabase";
import { fetchGitHubDigest } from "@/lib/integrations/enrichment/github";
import { searchLinkedIn, searchCandidate } from "@/lib/integrations/enrichment/tavily";
import { synthesizeResearch } from "@/lib/ai/prompts/synthesizeResearch";

export async function enrichCandidate(applicationId: string): Promise<void> {
  const { data: raw, error } = await supabase
    .from("applications")
    .select("candidateName, linkedinUrl, githubUrl, resumeText")
    .eq("id", applicationId)
    .single();

  if (error) throw new Error(`Application ${applicationId} not found`);

  const application = raw as {
    candidateName: string;
    linkedinUrl: string | null;
    githubUrl: string | null;
    resumeText: string;
  };

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

  const githubUsername =
    githubDigest.status === "fulfilled" && githubDigest.value
      ? githubDigest.value.username
      : undefined;

  const enrichmentData = {
    linkedinUrl: application.linkedinUrl,
    linkedinSummary: onlineData.linkedinSummary ?? null,
    githubUsername: githubUsername ?? null,
    githubDigest: onlineData.githubDigest
      ? JSON.parse(JSON.stringify(onlineData.githubDigest))
      : null,
    candidateBrief: synthesis.candidateBrief,
    discrepancies: synthesis.discrepancies,
    enrichedAt: new Date().toISOString(),
  };

  // Check if enrichment row exists (upsert-safe pattern)
  const { data: existing } = await supabase
    .from("candidate_enrichments")
    .select("id")
    .eq("applicationId", applicationId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("candidate_enrichments")
      .update(enrichmentData)
      .eq("applicationId", applicationId);
  } else {
    await supabase.from("candidate_enrichments").insert({
      id: crypto.randomUUID(),
      applicationId,
      ...enrichmentData,
    });
  }
}

function extractGitHubUsername(url: string): string {
  const match = url.match(/github\.com\/([^/?#]+)/);
  return match?.[1] ?? url;
}
