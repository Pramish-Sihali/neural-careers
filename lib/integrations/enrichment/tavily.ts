import { tavily } from "@tavily/core";

let client: ReturnType<typeof tavily> | null = null;

function getClient() {
  if (!client) client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  return client;
}

export async function searchCandidate(
  name: string,
  context: string
): Promise<string> {
  const tv = getClient();
  const result = await tv.search(`${name} ${context}`, {
    searchDepth: "basic",
    maxResults: 3,
  });
  return result.results.map((r) => `${r.title}: ${r.content}`).join("\n\n");
}

export async function searchLinkedIn(
  name: string,
  company?: string
): Promise<string> {
  const tv = getClient();
  const query = company
    ? `site:linkedin.com/in "${name}" "${company}"`
    : `site:linkedin.com/in "${name}" engineer OR manager OR developer`;
  const result = await tv.search(query, { searchDepth: "basic", maxResults: 2 });
  return result.results.map((r) => r.content).join("\n\n");
}
