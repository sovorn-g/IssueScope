# IssueScope / Maintainer Radar — Engineering Plan

## Project Goal

IssueScope, also called Maintainer Radar, is a resume portfolio web app for recruiters and senior engineer interviewers. It helps open-source maintainers triage GitHub issues faster by ranking issue severity, detecting semantic duplicates, flagging missing reproduction details, and drafting maintainer replies.

The project should demonstrate full-stack engineering, GitHub API integration, pragmatic security decisions, LLM classification, a RAG-style retrieval pipeline over GitHub issues, database modeling, and clean product scoping.

## Core User Flow

```text
User enters public GitHub repo URL + GitHub PAT
  ↓
App fetches latest open issues from GitHub
  ↓
AI analyzes issues
  ↓
Dashboard ranks issues by severity
  ↓
User clicks an issue
  ↓
App shows duplicates, missing repro flag, and draft maintainer reply
```

## Locked Product Decisions

### GitHub PAT

Live repo sync requires a GitHub PAT.

Rules:

- User provides PAT when importing or syncing a repo.
- PAT is used only for GitHub API requests.
- PAT is never stored in Postgres.
- PAT is never logged.
- Frontend may keep PAT only in active browser session, preferably in memory or `sessionStorage`.
- If the user refreshes/closes the session and the PAT is gone, they must re-enter it to sync again.

Rationale:

- Avoids low unauthenticated GitHub API rate limits.
- Avoids dangerous server-side token storage.
- Creates a strong interview talking point around security and product tradeoffs.

### GitHub Data Ingestion

Live sync imports:

- Public repository metadata
- Latest open issues
- Issue title
- Issue body
- Labels
- Author
- Created/updated timestamps
- Comment count
- Issue URL/state/number

MVP cap:

> Analyze the latest 200 open issues.

Important GitHub API behavior:

- GitHub's Issues API includes pull requests.
- Filter out any item with a `pull_request` field.

### Comments Strategy

Dashboard analysis does not analyze comments upfront.

Dashboard analysis uses:

- Issue title
- Issue body
- Labels
- Metadata
- Comment count

Comments are used later for:

- Issue detail panel
- Draft maintainer reply
- Optional context summary

Comment cap for detail view:

> Use the first 3 comments + latest 7 comments, or simply the latest 10 comments.

Rationale:

- Keeps initial sync fast.
- Reduces LLM token cost.
- Avoids huge threads slowing down analysis.
- Most users only open a few issues.

### AI / RAG Processing

IssueScope uses a deterministic AI pipeline, not an autonomous agent workflow. The MVP does not need LangGraph because the core workflow is predictable: fetch issues, classify them, embed them, retrieve similar issues, and draft replies on demand.

The RAG portion is:

```text
Issue title/body/labels
  ↓
Generate embedding
  ↓
Store/search vectors with pgvector
  ↓
Retrieve semantically similar issues from the same repo
  ↓
Use retrieved issues as duplicate candidates and reply-drafting context
```

Dashboard AI produces, per issue:

- Severity: `critical | high | medium | low`
- Missing reproduction flag: `true | false`
- Short reasoning
- Normalized issue text for embedding

Recommended batching:

- LLM classification: 10 issues per call
- Embeddings: 50 issues per batch

Duplicate detection is the main RAG retrieval step. It uses embeddings over:

```text
issue title + issue body + labels
```

Duplicate search should compare issues only within the same repository. Retrieved duplicate candidates can also be passed into the reply-drafting prompt as context, making reply drafting RAG-assisted.

Reply drafting is generated lazily:

> Generate a maintainer reply only when the user opens an issue detail panel.

Reply drafting uses:

- Issue title/body
- Labels
- Duplicate candidates
- Bounded comments
- Missing repro flag
- Severity

## Stack Plan

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui

Primary UI areas:

- Landing/import page
- Repo dashboard
- Issue table/list
- Severity filters
- Duplicate badges
- Missing repro badges
- Issue detail side panel
- Sync status/progress UI
- Settings panel for auto-sync-on-visit

### Backend

Use Next.js server routes or server actions.

Recommended modules:

```text
/lib/github
  parse repo URL
  fetch repo metadata
  fetch issues
  fetch issue comments
  handle pagination/rate limits

/lib/ai
  classify severity
  detect missing repro
  generate embeddings
  draft maintainer reply

/lib/sync
  create sync run
  upsert repo/issues
  process issue batches
  update sync status

/lib/security
  redact PAT
  validate request input
  prevent token logging
```

### Database

Use:

- Postgres
- Prisma
- pgvector

Main tables:

```text
repositories
issues
issue_comments
issue_analyses
issue_embeddings
duplicate_candidates
sync_runs
```

Do not create a PAT table.

Do not store GitHub tokens.

### Vector Search

Use pgvector inside Postgres.

Rationale:

- Keeps infrastructure simple.
- Avoids a separate vector database for MVP.
- Good enough for a portfolio project.
- Easy to explain in interviews.

## Sync Behavior

### First Sync

```text
Create sync_run
Fetch repo metadata
Fetch latest 200 open issues
Filter out PRs
Upsert issues
Analyze issues in batches
Generate embeddings
Compute duplicate candidates
Mark sync_run complete
```

### Manual Sync

User clicks:

> Sync Now

Manual sync requires a PAT. If the PAT is not available in the browser session, ask the user to re-enter it.

### Auto-Sync

No true background sync for MVP.

Instead:

> Auto-sync when the user revisits the dashboard and the PAT is available in the active browser session.

The auto-sync setting can live in browser `localStorage`.

The PAT should not live in `localStorage`.

## Data Model Draft

### repositories

Stores public GitHub repo metadata.

Suggested fields:

- `id`
- `githubRepoId`
- `owner`
- `name`
- `fullName`
- `htmlUrl`
- `defaultBranch`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Unique constraints:

- `githubRepoId`
- `owner + name`

### issues

Stores GitHub issues, excluding pull requests.

Suggested fields:

- `id`
- `repositoryId`
- `githubIssueId`
- `number`
- `title`
- `body`
- `state`
- `authorLogin`
- `labelsJson`
- `commentsCount`
- `htmlUrl`
- `githubCreatedAt`
- `githubUpdatedAt`
- `contentHash`
- `createdAt`
- `updatedAt`

Unique constraints:

- `githubIssueId`
- `repositoryId + number`

### issue_comments

Stores comments only when fetched for detail/reply context.

Suggested fields:

- `id`
- `issueId`
- `githubCommentId`
- `authorLogin`
- `body`
- `htmlUrl`
- `githubCreatedAt`
- `githubUpdatedAt`
- `createdAt`
- `updatedAt`

Unique constraints:

- `githubCommentId`

### issue_analyses

Stores AI analysis for dashboard display.

Suggested fields:

- `id`
- `issueId`
- `severity`
- `missingRepro`
- `reasoning`
- `model`
- `inputHash`
- `createdAt`
- `updatedAt`

Unique constraints:

- `issueId`

### issue_embeddings

Stores vector embeddings for duplicate detection.

Suggested fields:

- `id`
- `issueId`
- `embedding`
- `model`
- `inputHash`
- `createdAt`
- `updatedAt`

Unique constraints:

- `issueId`

### duplicate_candidates

Stores semantic duplicate candidates.

Suggested fields:

- `id`
- `sourceIssueId`
- `candidateIssueId`
- `score`
- `createdAt`

Constraints:

- `sourceIssueId != candidateIssueId`
- Unique `sourceIssueId + candidateIssueId`

### sync_runs

Tracks sync progress and failures.

Suggested fields:

- `id`
- `repositoryId`
- `status`: `pending | running | completed | failed | partial`
- `syncType`: `full | incremental | demo_seed`
- `startedAt`
- `completedAt`
- `issuesFetched`
- `issuesAnalyzed`
- `errorMessage`
- `createdAt`
- `updatedAt`

## API Contract Draft

### `POST /api/repos/parse`

Input:

```json
{
  "repoUrl": "https://github.com/vercel/next.js"
}
```

Output:

```json
{
  "owner": "vercel",
  "repo": "next.js",
  "fullName": "vercel/next.js"
}
```

### `POST /api/sync`

Input:

```json
{
  "repoUrl": "https://github.com/vercel/next.js",
  "pat": "github_pat_...",
  "mode": "full"
}
```

Output:

```json
{
  "syncRunId": "...",
  "repositoryId": "...",
  "status": "running"
}
```

Notes:

- PAT is accepted only for this request/session.
- Server must not log request body.
- Server must redact token from any error.

### `GET /api/sync/:syncRunId`

Output:

```json
{
  "id": "...",
  "status": "running",
  "issuesFetched": 120,
  "issuesAnalyzed": 80,
  "errorMessage": null
}
```

### `GET /api/repos/:repositoryId/issues`

Returns dashboard issue data with analysis.

### `GET /api/issues/:issueId`

Returns detail data for one issue.

### `POST /api/issues/:issueId/comments/sync`

Fetches bounded comments for an issue using the current PAT.

### `POST /api/issues/:issueId/draft-reply`

Generates a reply draft lazily.

Input should include PAT only if comments need to be fetched first.

## Edge Cases and Recovery

| Failure / edge case | User impact | Detection | Prevention | Recovery |
| --- | --- | --- | --- | --- |
| Invalid GitHub URL | Cannot import repo | URL parser error | Validate owner/repo format before sync | Show correction message |
| Bad PAT | Sync fails | GitHub 401/403 | Explain PAT requirements | Ask user to re-enter PAT |
| GitHub rate limit | Sync stalls/fails | GitHub rate-limit headers | Require PAT, cap issue count | Show retry time |
| Huge repo | Slow import | Issue/page count | Cap import to latest 200 open issues | Let user adjust later |
| PRs included in issues API | Dashboard pollution | `pull_request` field exists | Filter during ingest | Remove accidental PR rows |
| Tab closes mid-sync | Partial data | `sync_runs.status` | Chunked/idempotent processing | Resume or restart sync |
| PAT missing on revisit | Auto-sync cannot run | No session token | Do not store PAT server-side | Ask user to re-enter PAT |
| AI returns malformed JSON | Bad/missing analysis | Schema parse failure | Structured output validation | Retry or fallback |
| Duplicate threshold too noisy | Bad duplicate suggestions | Low confidence scores | Store similarity score and threshold | Hide below threshold |
| Issue changed after analysis | Stale severity/duplicates | `githubUpdatedAt` and `contentHash` | Recompute only when hash changes | Re-analyze changed issue |
| Database write partially fails | Incomplete dashboard | Sync run error | Transactions for critical writes | Mark sync partial/failed and retry |

## Testing Plan

### Unit Tests

- GitHub repo URL parser
- PAT redaction utility
- Issue normalization
- PR filtering
- Content hashing
- Severity schema parsing
- Missing repro output validation
- Duplicate threshold logic

### Integration Tests

- GitHub sync with mocked API responses
- Incremental sync using `since`
- Idempotent issue/comment upserts
- pgvector similarity query
- AI response retry/fallback behavior
- Lazy comment fetch and reply drafting

### E2E / Smoke Tests

- Import public repo with PAT
- Try sample/demo repo path
- Dashboard renders ranked issues
- Sync Now flow
- Auto-sync-on-visit behavior
- Open issue detail and generate draft reply
- Missing PAT prompts user to re-enter token

### Manual QA Checklist

- Invalid repo URL shows helpful message
- Bad PAT shows helpful message
- PAT never appears in logs or UI after submission
- Issue dashboard loads after sync
- PRs are excluded
- Duplicate badges link to valid GitHub issues
- Missing repro badges are understandable
- Draft reply is editable/copyable

## Observability and Debuggability

Minimum MVP observability:

- `sync_runs` table with status/progress/error fields
- Server logs for sync lifecycle without secrets
- Redacted GitHub error messages
- Visible sync progress in UI
- Last synced timestamp on dashboard

Never log:

- PAT
- Full request body containing PAT
- Authorization headers

## Rollout Plan

1. Scaffold app and styling.
2. Add Prisma/Postgres schema.
3. Implement GitHub URL parsing and PAT-safe GitHub client.
4. Implement sync run creation and issue ingestion.
5. Build dashboard UI with mocked data.
6. Connect dashboard to real stored issue data.
7. Add LLM severity/missing repro analysis.
8. Add embeddings and duplicate detection.
9. Add lazy issue detail comments and reply drafting.
10. Add sample/demo repo path.
11. Add tests, README, screenshots/GIF, and deployment.

## Rollback / Recovery Plan

For MVP, rollback is mostly operational:

- If AI analysis breaks, keep raw issue dashboard working.
- If duplicate detection breaks, hide duplicate badges and show severity/missing repro only.
- If sync fails midway, mark `sync_run` as `failed` or `partial` and allow retry.
- If database migration fails during development, reset local DB and reseed demo data.
- If deployed app has a bad release, rollback to previous deployment through hosting provider.

## Recommended Defaults

| Area | Decision |
| --- | --- |
| Live sync auth | PAT required |
| Store PAT server-side | No |
| Store PAT client-side | Session only, preferably memory or `sessionStorage` |
| Issue import cap | 200 open issues |
| Comments upfront | No |
| Comments on detail | Yes, capped |
| LLM batch size | 10 issues |
| Embedding batch size | 50 issues |
| Reply draft | Lazy/on-demand |
| Database | Postgres |
| ORM | Prisma |
| Vector search | pgvector |
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui |

## Agent / Orchestration Decision

Do not use LangGraph for the MVP. The product is better served by a simple, testable, deterministic pipeline.

LangGraph or agent orchestration may be considered later only if the product adds autonomous multi-step maintainer workflows, such as deciding which GitHub actions to take, asking follow-up questions, or coordinating multiple tool calls with human approval.

## Open Implementation Decisions

- Which LLM provider to use first.
- Which embedding model to use first.
- Whether sync processing should be fully request-driven at first or use a lightweight job queue later.
- Which public repo should be used for the default sample demo.
- Whether to generate sample demo data manually or via a seed script.
