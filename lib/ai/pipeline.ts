import { prisma } from "@/lib/prisma";
import { analyzeIssues, embedIssueTexts } from "./provider";
import { embeddingInput } from "./normalize";

const ANALYSIS_BATCH = 10;
const ANALYSIS_CONCURRENCY = 7;
const EMBEDDING_BATCH = 70;
const DUPLICATE_THRESHOLD = 0.78;

type DbIssue = { id: string; repositoryId: string; number: number; title: string; body: string | null; labels: string[]; commentCount: number; contentHash: string };

export async function runAiPipeline(repositoryId: string) {
  console.info("[ai] pipeline:start", { repositoryId });
  await confirmPgvector();
  const issues = await prisma.issue.findMany({ where: { repositoryId }, orderBy: { githubUpdatedAt: "desc" }, take: 200 });
  console.info("[ai] pipeline:issues-loaded", { repositoryId, issueCount: issues.length });
  const analysis = await analyzeChangedIssues(issues);
  const embeddings = await embedChangedIssues(issues);
  const duplicates = await refreshDuplicateCandidates(repositoryId);
  console.info("[ai] pipeline:done", { repositoryId, analysis, embeddings, duplicates });
  if (analysis.failedBatches > 0 || embeddings.failedBatches > 0) {
    throw new Error(`AI pipeline partially failed: analysis failed batches=${analysis.failedBatches}, embedding failed batches=${embeddings.failedBatches}`);
  }
}

async function confirmPgvector() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
}

async function analyzeChangedIssues(issues: DbIssue[]) {
  const existing = await prisma.issueAnalysis.findMany({ where: { issueId: { in: issues.map((i) => i.id) } }, select: { issueId: true, contentHash: true, analysisStatus: true } });
  const fresh = new Map(existing.map((a) => [a.issueId, a]));
  const pending = issues.filter((i) => fresh.get(i.id)?.contentHash !== i.contentHash || fresh.get(i.id)?.analysisStatus === "failed");
  const batches = chunk(pending, ANALYSIS_BATCH);
  let completed = 0;
  let failedBatches = 0;
  let failedIssues = 0;
  console.info("[ai] analysis:start", { totalIssues: issues.length, pendingIssues: pending.length, batchSize: ANALYSIS_BATCH, concurrency: ANALYSIS_CONCURRENCY, batchCount: batches.length });

  for (let i = 0; i < batches.length; i += ANALYSIS_CONCURRENCY) {
    const batchGroup = batches.slice(i, i + ANALYSIS_CONCURRENCY);
    const results = await Promise.all(batchGroup.map((batch, offset) => analyzeIssueBatch(batch, i + offset + 1)));
    for (const result of results) {
      completed += result.completed;
      failedIssues += result.failedIssues;
      if (result.failedBatch) failedBatches++;
    }
  }

  console.info("[ai] analysis:done", { pendingIssues: pending.length, completed, failedIssues, failedBatches });
  return { pendingIssues: pending.length, completed, failedIssues, failedBatches };
}

async function analyzeIssueBatch(batch: DbIssue[], batchIndex: number) {
  try {
    console.info("[ai] analysis:batch:start", { batchIndex, issueCount: batch.length, issueNumbers: batch.map((issue) => issue.number) });
    const results = await analyzeIssues(batch);
    console.info("[ai] analysis:batch:received", { batchIndex, resultCount: results.length });

    const issueByIdOrNumber = new Map<string, DbIssue>();
    for (const issue of batch) {
      issueByIdOrNumber.set(issue.id, issue);
      issueByIdOrNumber.set(String(issue.number), issue);
      issueByIdOrNumber.set(`#${issue.number}`, issue);
    }

    let completed = 0;
    const matchedIssueIds = new Set<string>();
    for (const result of results) {
      const issue = issueByIdOrNumber.get(result.issueId);
      if (!issue) {
        console.warn("[ai] analysis:result:unmatched", { batchIndex, returnedIssueId: result.issueId, expectedIssueIds: batch.map((x) => x.id), expectedIssueNumbers: batch.map((x) => x.number) });
        continue;
      }
      matchedIssueIds.add(issue.id);
      await prisma.issueAnalysis.upsert({
        where: { issueId: issue.id },
        create: { issueId: issue.id, contentHash: issue.contentHash, analysisStatus: "completed", severity: result.severity, severityReason: result.severityReason, missingRepro: result.missingRepro, missingReproReason: result.missingReproReason },
        update: { contentHash: issue.contentHash, analysisStatus: "completed", severity: result.severity, severityReason: result.severityReason, missingRepro: result.missingRepro, missingReproReason: result.missingReproReason },
      });
      completed++;
    }

    const missing = batch.filter((issue) => !matchedIssueIds.has(issue.id));
    if (missing.length) {
      const message = "AI analysis did not return a matching result for this issue.";
      console.warn("[ai] analysis:batch:missing-results", { batchIndex, missingIssueNumbers: missing.map((issue) => issue.number), returnedIssueIds: results.map((result) => result.issueId) });
      await Promise.all(missing.map((issue) => prisma.issueAnalysis.upsert({
        where: { issueId: issue.id },
        create: { issueId: issue.id, contentHash: issue.contentHash, analysisStatus: "failed", severityReason: message },
        update: { contentHash: issue.contentHash, analysisStatus: "failed", severityReason: message },
      })));
    }

    return { completed, failedIssues: missing.length, failedBatch: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    console.error("[ai] analysis:batch:failed", { batchIndex, issueCount: batch.length, issueNumbers: batch.map((issue) => issue.number), errorName: error instanceof Error ? error.name : typeof error, errorMessage: message, errorStack: error instanceof Error ? error.stack : undefined });
    await Promise.all(batch.map((issue) => prisma.issueAnalysis.upsert({
      where: { issueId: issue.id },
      create: { issueId: issue.id, contentHash: issue.contentHash, analysisStatus: "failed", severityReason: message },
      update: { contentHash: issue.contentHash, analysisStatus: "failed", severityReason: message },
    })));
    return { completed: 0, failedIssues: batch.length, failedBatch: true };
  }
}

async function embedChangedIssues(issues: DbIssue[]) {
  const existing = await prisma.issueEmbedding.findMany({ where: { issueId: { in: issues.map((i) => i.id) } }, select: { issueId: true, contentHash: true } });
  const fresh = new Map(existing.map((e) => [e.issueId, e.contentHash]));
  const pending = issues.filter((i) => fresh.get(i.id) !== i.contentHash);
  let completed = 0;
  let failedBatches = 0;
  console.info("[ai] embeddings:start", { totalIssues: issues.length, pendingIssues: pending.length, batchSize: EMBEDDING_BATCH });
  for (let i = 0; i < pending.length; i += EMBEDDING_BATCH) {
    const batch = pending.slice(i, i + EMBEDDING_BATCH);
    try {
      console.info("[ai] embeddings:batch:start", { batchIndex: Math.floor(i / EMBEDDING_BATCH) + 1, issueCount: batch.length, issueNumbers: batch.map((issue) => issue.number) });
      const embeddings = await embedIssueTexts(batch.map(embeddingInput));
      console.info("[ai] embeddings:batch:received", { batchIndex: Math.floor(i / EMBEDDING_BATCH) + 1, embeddingCount: embeddings.length, dimensions: embeddings[0]?.length ?? 0 });
      // Raw SQL required: Prisma can't serialize Unsupported("vector") fields
      for (let j = 0; j < batch.length; j++) {
        const issue = batch[j];
        const vectorStr = `[${embeddings[j].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO issue_embeddings (id, "issueId", embedding, "contentHash", "updatedAt")
           VALUES ($1, $2, $3::vector, $4, NOW())
           ON CONFLICT ("issueId") DO UPDATE SET
             embedding = EXCLUDED.embedding,
             "contentHash" = EXCLUDED."contentHash",
             "updatedAt" = NOW()`,
          crypto.randomUUID(), issue.id, vectorStr, issue.contentHash,
        );
      }
      completed += batch.length;
    } catch (error) {
      failedBatches++;
      console.error("[ai] embeddings:batch:failed", { batchIndex: Math.floor(i / EMBEDDING_BATCH) + 1, issueCount: batch.length, issueNumbers: batch.map((issue) => issue.number), errorName: error instanceof Error ? error.name : typeof error, errorMessage: error instanceof Error ? error.message : "Embedding failed", errorStack: error instanceof Error ? error.stack : undefined });
    }
  }
  console.info("[ai] embeddings:done", { pendingIssues: pending.length, completed, failedBatches });
  return { pendingIssues: pending.length, completed, failedBatches };
}

async function refreshDuplicateCandidates(repositoryId: string) {
  // Delete all existing candidates for this repo before rebuilding
  const deleted = await prisma.duplicateCandidate.deleteMany({ where: { sourceIssue: { repositoryId } } });
  console.info("[ai] duplicates:start", { repositoryId, deleted: deleted.count, threshold: DUPLICATE_THRESHOLD });

  // Single pgvector query: find all pairs above threshold using cosine distance (<=>)
  // No top-3 truncation — all pairs above threshold are stored for accurate DFS grouping
  await prisma.$executeRawUnsafe(
    `INSERT INTO duplicate_candidates (id, "sourceIssueId", "targetIssueId", score, reason)
     SELECT
       gen_random_uuid()::text,
       a."issueId",
       b."issueId",
       1 - (a.embedding <=> b.embedding),
       'Semantic embedding similarity'
     FROM issue_embeddings a
     JOIN issue_embeddings b
       ON b."issueId" != a."issueId"
     WHERE a."issueId" IN (SELECT id FROM issues WHERE "repositoryId" = $1)
       AND b."issueId" IN (SELECT id FROM issues WHERE "repositoryId" = $1)
       AND a.embedding IS NOT NULL
       AND b.embedding IS NOT NULL
       AND 1 - (a.embedding <=> b.embedding) >= $2
     ON CONFLICT ("sourceIssueId", "targetIssueId") DO UPDATE SET
       score = EXCLUDED.score,
       reason = EXCLUDED.reason`,
    repositoryId,
    DUPLICATE_THRESHOLD,
  );

  // Count final candidates after upsert
  const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint as count FROM duplicate_candidates WHERE "sourceIssueId" IN (SELECT id FROM issues WHERE "repositoryId" = $1)`,
    repositoryId,
  );
  const created = Number(countResult[0]?.count ?? 0);
  console.info("[ai] duplicates:done", { repositoryId, created });
  return { created };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}


