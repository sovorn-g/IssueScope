-- Convert issue_embeddings.embedding from JSONB to native pgvector vector type

-- Step 1: Add temporary vector column
ALTER TABLE "issue_embeddings" ADD COLUMN "embedding_vec" vector;

-- Step 2: Convert existing JSONB arrays to vector
-- pgvector accepts '[0.1,0.2,...]' text format via ::vector cast
UPDATE "issue_embeddings"
SET "embedding_vec" = ("embedding" #>> '{}')::vector
WHERE "embedding" IS NOT NULL;

-- Step 3: Drop old JSONB column
ALTER TABLE "issue_embeddings" DROP COLUMN "embedding";

-- Step 4: Rename new vector column
ALTER TABLE "issue_embeddings" RENAME COLUMN "embedding_vec" TO "embedding";
