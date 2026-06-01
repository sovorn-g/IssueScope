import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { parseGitHubRepoUrl } from "@/lib/github/parser";
import { GitHubClient } from "@/lib/github/client";
import { safeErrorMessage } from "@/lib/security";
import { runAiPipeline } from "@/lib/ai/pipeline";

export async function POST(request: Request) {
  let syncRunId: string | undefined;
  try {
    const { repoUrl, pat } = await request.json();
    if (!pat || typeof pat !== "string") return NextResponse.json({ error: "A GitHub token is required for live sync." }, { status: 400 });
    const parsed = parseGitHubRepoUrl(String(repoUrl ?? ""));

    const syncRun = await prisma.syncRun.create({ data: { status: "running", currentStep: "Connecting to GitHub", repositoryFullName: parsed.fullName } });
    syncRunId = syncRun.id;

    const client = new GitHubClient(pat);
    const repo = await client.getRepository(parsed.owner, parsed.name);
    await prisma.syncRun.update({ where: { id: syncRun.id }, data: { currentStep: "Fetching repository metadata" } });

    const repository = await prisma.repository.upsert({
      where: { githubId: BigInt(repo.id) },
      create: {
        githubId: BigInt(repo.id), owner: repo.owner.login, name: repo.name, fullName: repo.full_name, htmlUrl: repo.html_url,
        description: repo.description, defaultBranch: repo.default_branch, openIssuesCount: repo.open_issues_count,
      },
      update: { owner: repo.owner.login, name: repo.name, fullName: repo.full_name, htmlUrl: repo.html_url, description: repo.description, defaultBranch: repo.default_branch, openIssuesCount: repo.open_issues_count },
    });

    await prisma.syncRun.update({ where: { id: syncRun.id }, data: { repositoryId: repository.id, currentStep: "Fetching latest open issues" } });
    const issues = await client.getLatestOpenIssues(parsed.owner, parsed.name, 200);
    await prisma.syncRun.update({ where: { id: syncRun.id }, data: { issuesFetched: issues.length, currentStep: "Filtering pull requests" } });

    let stored = 0;
    for (const issue of issues) {
      await prisma.issue.upsert({
        where: { githubId: issue.githubId },
        create: { ...issue, repositoryId: repository.id },
        update: { ...issue, repositoryId: repository.id },
      });
      stored++;
    }

    await prisma.repository.update({ where: { id: repository.id }, data: { lastSyncedAt: new Date() } });

    let aiError: string | null = null;
    try {
      await prisma.syncRun.update({ where: { id: syncRun.id }, data: { currentStep: "Running AI triage and duplicate detection", issuesStored: stored } });
      await runAiPipeline(repository.id);
    } catch (error) {
      aiError = safeErrorMessage(error);
    }

    const completed = await prisma.syncRun.update({ where: { id: syncRun.id }, data: { status: aiError ? "partial" : "completed", currentStep: aiError ? "AI analysis failed; raw issues are available" : "Preparing dashboard", issuesStored: stored, errorMessage: aiError, completedAt: new Date() } });

    return NextResponse.json(jsonSafe({ syncRun: completed, repositoryId: repository.id, aiError }));
  } catch (error) {
    const message = safeErrorMessage(error);
    if (syncRunId) await prisma.syncRun.update({ where: { id: syncRunId }, data: { status: "failed", errorMessage: message, completedAt: new Date() } }).catch(() => null);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
