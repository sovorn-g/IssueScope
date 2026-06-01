import { NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { parseGitHubRepoUrl } from "@/lib/github/parser";
import { safeErrorMessage } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const { repoUrl, pat } = await request.json();
    if (!pat || typeof pat !== "string") {
      return NextResponse.json({ error: "A GitHub token is required." }, { status: 400 });
    }

    const parsed = parseGitHubRepoUrl(String(repoUrl ?? ""));
    const repo = await new GitHubClient(pat).getRepository(parsed.owner, parsed.name);

    return NextResponse.json({
      valid: true,
      repository: {
        githubId: repo.id,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        openIssuesCount: repo.open_issues_count,
      },
    });
  } catch (error) {
    return NextResponse.json({ valid: false, error: safeErrorMessage(error) }, { status: 400 });
  }
}
