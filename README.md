# IssueScope

AI issue triage for open-source maintainers. Sync a public GitHub repository, get severity classification, missing-repro detection, and semantic duplicate grouping — all in a ranked, filterable dashboard.

## Quick start

```bash
npm install
cp .env.example .env     # add at least one AI provider key (see below)
docker compose up -d      # starts PostgreSQL + pgvector
npx prisma migrate dev    # creates database tables
npm run dev               # http://localhost:3000
```

Requires **Node.js 18+** and **Docker**.

## How it works

1. **Paste a GitHub repo URL** on the landing page, enter a [personal access token](https://github.com/settings/tokens) (classic or fine-grained with `public_repo` scope), and click Sync Now.
2. **The app fetches the latest 200 open issues** (pull requests are filtered out), prunes any closed or stale rows from the database, and runs the AI pipeline.
3. **AI analysis** classifies every issue by severity (critical / high / medium / low), flags reports that are missing reproduction steps, and embeds issue text for semantic duplicate detection.
4. **Your dashboard** is ready at `/dashboard/[repositoryId]` — a persistent, shareable URL. Re-sync anytime to pull fresh issues; only changed or new content re-triggers AI work.

GitHub tokens are sent over the wire for sync requests only. They are **never stored** server-side.

## Dashboard features

| Feature | Description |
|---------|-------------|
| **Summary cards** | Critical, High, Medium, Low, and Missing Repro counts at a glance |
| **Triage queue** | Paginated issue list (10 per page) sorted by severity, with AI reasoning |
| **Filters** | All / Critical / High / Medium / Low / Missing / Dupes |
| **Duplicate groups** | Issues connected by semantic similarity displayed as grouped components |
| **Issue detail panel** | Full body, AI severity reasoning, missing-repro flag, and clickable duplicate links |
| **Re-sync** | "Sync now" button on the dashboard opens a PAT modal, fetches fresh GitHub data, and shows a post-sync report (new / updated / deleted counts + AI status) |
| **Multi-repo** | Landing page lists all previously synced repositories; delete or re-open any |

## AI providers

IssueScope supports multiple AI providers via the [Vercel AI SDK](https://sdk.vercel.ai). Configure at least one text provider and one embedding provider in your `.env` file.

### Text (severity + missing repro)

| Provider | Env var | Model (default) |
|----------|---------|-----------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` |

### Embeddings (duplicate detection)

| Provider | Env var | Model (default) |
|----------|---------|-----------------|
| OpenAI | `OPENAI_API_KEY` | `text-embedding-3-small` |
| Gemini | `GEMINI_API_KEY` | `text-embedding-004` |
| Voyage | `VOYAGE_API_KEY` | `voyage-4-lite` |

If you only set `OPENAI_API_KEY`, both text and embedding default to OpenAI.

### Advanced config

| Env var | Default | Purpose |
|---------|---------|---------|
| `AI_TEXT_PROVIDER` | `openai` | Which text provider to use (`openai`, `gemini`, `deepseek`) |
| `AI_TEXT_MODEL` | provider default | Override the text model name |
| `AI_EMBEDDING_PROVIDER` | matches text provider | Which embedding provider to use (`openai`, `gemini`, `voyage`) |
| `AI_EMBEDDING_MODEL` | provider default | Override the embedding model name |
| `AI_PAGE_ANALYSIS_SIZE` | `10` | Batch size for severity analysis |
| `AI_EMBEDDING_BATCH_SIZE` | `70` | Batch size for embedding generation |
| `DUPLICATE_THRESHOLD` | `0.78` | Cosine-similarity threshold for duplicate candidates |

## How duplicate detection works

1. Issue text (title + body + labels) is normalized and truncated to ~4 KB.
2. The configured embedding provider generates a vector (e.g. 1024 dimensions for Voyage).
3. Vectors are stored as a native PostgreSQL `vector` column via the pgvector extension.
4. On each sync, all pairwise cosine distances are computed with a single SQL query using the `<=>` operator.
5. Pairs scoring ≥ the configurable threshold are stored in `duplicate_candidates`.
6. The frontend builds an undirected graph from those pairs and runs DFS to produce connected-component duplicate groups.

Content hashes (SHA-256 of title + body + labels) guard against redundant work: only issues whose content changed since the last sync re-trigger analysis and embedding.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Database | PostgreSQL 16 + pgvector (Docker) |
| ORM | Prisma |
| AI | Vercel AI SDK (OpenAI / Gemini / DeepSeek / Voyage) |
| Validation | Zod |
| Icons | Lucide React |
| Fonts | Fraunces (display) + IBM Plex Sans (body) |

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/parse-repo` | Validate and parse a GitHub URL |
| `POST` | `/api/validate-github` | Validate repo URL + PAT against GitHub API |
| `POST` | `/api/sync` | Full sync: fetch issues, ingest, run AI pipeline |
| `GET` | `/api/sync/[id]` | Poll a sync run's status |
| `GET` | `/api/repositories` | List connected repositories |
| `DELETE` | `/api/repositories` | Remove a repository (cascade) |
| `GET` | `/api/dashboard/[repositoryId]` | Dashboard issue list with analysis and duplicates |
| `GET` | `/api/issues/[issueId]` | Single issue detail with comments and analysis |

## Project structure

```
app/                         Next.js App Router
  page.tsx                   Landing page (import, sync, sample demo)
  dashboard/[repositoryId]/  Dashboard: triage queue, filters, detail panel
  api/                       8 API route handlers
lib/
  ai/                        AI pipeline, provider adapter, config, normalization
  github/                    GitHub API client, URL parser, issue sync/ingest
  prisma.ts                  Prisma singleton
  hash.ts                    Content hashing for incremental AI
  utils.ts                   Tailwind merge, duplicate-group DFS
components/ui/               shadcn/ui primitives (badge, button, card, input)
prisma/                      Schema (7 models) + migrations
docker/                      docker-compose.yml (pgvector)
```
