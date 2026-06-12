import { prisma } from "@/lib/prisma";
import type { NormalizedIssue } from "./client";

export async function ingestRepositoryIssues(repositoryId: string, issues: NormalizedIssue[]) {
  const fetchedIds = issues.map((issue) => issue.githubId);

  // Raw SQL: Prisma's notIn filter is unreliable with JavaScript bigint values.
  let prunedCount = 0;
  if (fetchedIds.length === 0) {
    const result = await prisma.issue.deleteMany({ where: { repositoryId } });
    prunedCount = result.count;
  } else {
    // Build a safe IN clause from known BigInt values (no SQL injection risk).
    const idList = fetchedIds.map((id) => String(id)).join(", ");
    const deleteResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
      `WITH deleted AS (
         DELETE FROM issues
         WHERE "repositoryId" = $1
           AND "githubId" NOT IN (${idList})
         RETURNING id
       )
       SELECT COUNT(*)::bigint as count FROM deleted`,
      repositoryId,
    );
    prunedCount = Number(deleteResult[0]?.count ?? 0);
  }

  console.info("[sync] ingest:prune", { repositoryId, fetchedCount: issues.length, pruned: prunedCount });

  // Determine which fetched issues are new vs existing for the sync report.
  const idListForCheck = fetchedIds.map((id) => String(id)).join(", ");
  const existingRows: Array<{ githubId: bigint }> = idListForCheck.length > 0
    ? await prisma.$queryRawUnsafe(
        `SELECT "githubId" FROM issues WHERE "repositoryId" = $1 AND "githubId" IN (${idListForCheck})`,
        repositoryId,
      )
    : [];
  const existingSet = new Set(existingRows.map((row) => String(row.githubId)));

  let inserted = 0;
  let updated = 0;
  for (const issue of issues) {
    const exists = existingSet.has(String(issue.githubId));
    await prisma.issue.upsert({
      where: { githubId: issue.githubId },
      create: { ...issue, repositoryId },
      update: { ...issue, repositoryId },
    });
    if (exists) updated++;
    else inserted++;
  }

  console.info("[sync] ingest:done", { repositoryId, inserted, updated, pruned: prunedCount });
  return { fetched: issues.length, inserted, updated, pruned: prunedCount };
}
