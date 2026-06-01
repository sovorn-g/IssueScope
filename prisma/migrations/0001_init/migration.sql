-- Initial IssueScope Phase 2 schema
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "SyncRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'partial');

CREATE TABLE "repositories" (
  "id" TEXT NOT NULL,
  "githubId" BIGINT NOT NULL,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "htmlUrl" TEXT NOT NULL,
  "description" TEXT,
  "defaultBranch" TEXT,
  "openIssuesCount" INTEGER,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issues" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "githubId" BIGINT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "state" TEXT NOT NULL,
  "htmlUrl" TEXT NOT NULL,
  "authorLogin" TEXT,
  "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "contentHash" TEXT NOT NULL,
  "githubCreatedAt" TIMESTAMP(3) NOT NULL,
  "githubUpdatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issue_comments" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "githubId" BIGINT NOT NULL,
  "body" TEXT NOT NULL,
  "authorLogin" TEXT,
  "htmlUrl" TEXT,
  "githubCreatedAt" TIMESTAMP(3) NOT NULL,
  "githubUpdatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issue_analyses" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "severity" TEXT,
  "severityReason" TEXT,
  "missingRepro" BOOLEAN,
  "missingReproReason" TEXT,
  "contentHash" TEXT NOT NULL,
  "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issue_analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issue_embeddings" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "embedding" JSONB,
  "model" TEXT,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "issue_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "duplicate_candidates" (
  "id" TEXT NOT NULL,
  "sourceIssueId" TEXT NOT NULL,
  "targetIssueId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_runs" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT,
  "repositoryFullName" TEXT,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'pending',
  "currentStep" TEXT,
  "issuesFetched" INTEGER NOT NULL DEFAULT 0,
  "issuesStored" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repositories_githubId_key" ON "repositories"("githubId");
CREATE INDEX "repositories_owner_name_idx" ON "repositories"("owner", "name");
CREATE UNIQUE INDEX "issues_githubId_key" ON "issues"("githubId");
CREATE UNIQUE INDEX "issues_repositoryId_number_key" ON "issues"("repositoryId", "number");
CREATE INDEX "issues_repositoryId_githubUpdatedAt_idx" ON "issues"("repositoryId", "githubUpdatedAt");
CREATE UNIQUE INDEX "issue_comments_githubId_key" ON "issue_comments"("githubId");
CREATE UNIQUE INDEX "issue_analyses_issueId_key" ON "issue_analyses"("issueId");
CREATE UNIQUE INDEX "issue_embeddings_issueId_key" ON "issue_embeddings"("issueId");
CREATE UNIQUE INDEX "duplicate_candidates_sourceIssueId_targetIssueId_key" ON "duplicate_candidates"("sourceIssueId", "targetIssueId");

ALTER TABLE "issues" ADD CONSTRAINT "issues_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_analyses" ADD CONSTRAINT "issue_analyses_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_embeddings" ADD CONSTRAINT "issue_embeddings_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_sourceIssueId_fkey" FOREIGN KEY ("sourceIssueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_targetIssueId_fkey" FOREIGN KEY ("targetIssueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
