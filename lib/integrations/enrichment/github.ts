interface GitHubRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
}

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  followers: number;
  public_repos: number;
}

export interface GitHubDigest {
  username: string;
  bio: string | null;
  followers: number;
  topLanguages: string[];
  topRepos: { name: string; stars: number; description: string | null }[];
}

async function ghFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchGitHubDigest(
  username: string
): Promise<GitHubDigest | null> {
  try {
    const [user, repos] = await Promise.all([
      ghFetch<GitHubUser>(`/users/${username}`),
      ghFetch<GitHubRepo[]>(`/users/${username}/repos?sort=stars&per_page=10`),
    ]);

    const ownRepos = repos.filter((r) => !r.fork);

    const langCounts: Record<string, number> = {};
    for (const repo of ownRepos) {
      if (repo.language) langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1;
    }
    const topLanguages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    return {
      username: user.login,
      bio: user.bio,
      followers: user.followers,
      topLanguages,
      topRepos: ownRepos.slice(0, 5).map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        description: r.description,
      })),
    };
  } catch {
    return null;
  }
}
