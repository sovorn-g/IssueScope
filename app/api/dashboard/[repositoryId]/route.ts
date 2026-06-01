import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) return NextResponse.json({ error: "Repository not found." }, { status: 404 });
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const issues = await prisma.issue.findMany({
    where: { repositoryId },
    orderBy: [{ githubUpdatedAt: "desc" }],
    take: 200,
    include: { analysis: true, duplicateSources: { include: { targetIssue: true }, take: 3, orderBy: { score: "desc" } } },
  });
  issues.sort((a, b) => (severityRank[a.analysis?.severity ?? ""] ?? 9) - (severityRank[b.analysis?.severity ?? ""] ?? 9) || Number(b.analysis?.missingRepro ?? false) - Number(a.analysis?.missingRepro ?? false) || b.duplicateSources.length - a.duplicateSources.length);
  const aiDegraded = issues.some((issue) => issue.analysis?.analysisStatus === "failed") || issues.some((issue) => !issue.analysis);
  return NextResponse.json(jsonSafe({ repository, issues, aiDegraded }));
}
