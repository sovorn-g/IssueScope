import { issueContentHash } from "@/lib/hash";

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string | null;
  open_issues_count: number;
  owner: { login: string };
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  labels: Array<string | { name?: string | null }>;
  comments: number;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
};

export type NormalizedIssue = {
  githubId: bigint;
  number: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  authorLogin: string | null;
  labels: string[];
  commentCount: number;
  contentHash: string;
  githubCreatedAt: Date;
  githubUpdatedAt: Date;
};

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "IssueScope",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const reset = res.headers.get("x-ratelimit-reset");
      const suffix = reset ? ` Rate limit resets at ${new Date(Number(reset) * 1000).toLocaleString()}.` : "";
      if (res.status === 401 || res.status === 403) throw new Error(`GitHub rejected this token or rate limited the request.${suffix}`);
      if (res.status === 404) throw new Error("Repository not found or token lacks access.");
      throw new Error(`GitHub request failed with status ${res.status}.${suffix}`);
    }

    return (await res.json()) as T;
  }

  getRepository(owner: string, repo: string) {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  async getLatestOpenIssues(owner: string, repo: string, cap = 200) {
    const all: NormalizedIssue[] = [];
    for (let page = 1; all.length < cap; page++) {
      const perPage = Math.min(100, cap - all.length);
      const batch = await this.request<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=desc&per_page=${perPage}&page=${page}`);
      if (batch.length === 0) break;
      const issues = batch.filter((issue) => !issue.pull_request).map(normalizeIssue);
      all.push(...issues.slice(0, cap - all.length));
      if (batch.length < perPage) break;
    }
    return all;
  }
}

function normalizeIssue(issue: GitHubIssue): NormalizedIssue {
  const labels = issue.labels.map((label) => (typeof label === "string" ? label : label.name ?? "")).filter(Boolean);
  return {
    githubId: BigInt(issue.id),
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    htmlUrl: issue.html_url,
    authorLogin: issue.user?.login ?? null,
    labels,
    commentCount: issue.comments,
    contentHash: issueContentHash({ title: issue.title, body: issue.body, labels }),
    githubCreatedAt: new Date(issue.created_at),
    githubUpdatedAt: new Date(issue.updated_at),
  };
}
