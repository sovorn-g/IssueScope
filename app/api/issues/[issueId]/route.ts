import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      comments: { orderBy: { githubUpdatedAt: "desc" }, take: 10 },
      analysis: true,
      duplicateSources: { include: { targetIssue: true }, orderBy: { score: "desc" }, take: 5 },
    },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  return NextResponse.json(jsonSafe({ issue }));
}
