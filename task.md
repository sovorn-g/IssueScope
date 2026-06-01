# IssueScope / Maintainer Radar — Execution Tasks

## Phase 1 — Foundation + Static Product Demo

Goal: create the app foundation and make the core portfolio experience visible with mocked data before backend complexity.

### Project setup

- [x] Scaffold Next.js App Router project.
- [x] Add TypeScript.
- [x] Add Tailwind CSS.
- [x] Add shadcn/ui.
- [x] Add linting/formatting setup.
- [x] Add basic environment variable structure.
- [x] Add initial README skeleton.

### Static UI prototype

- [x] Build landing/import page.
- [x] Add public GitHub repo URL input.
- [x] Add GitHub PAT input with visibility toggle.
- [x] Add PAT safety copy: token is used only for sync and never stored server-side.
- [x] Add “Try sample repo” CTA.
- [x] Build sync progress screen with mocked staged progress.
- [x] Build dashboard shell.
- [x] Build severity summary cards.
- [x] Build triage queue with mocked issues.
- [x] Build issue detail panel/drawer.
- [x] Build duplicate candidate display.
- [x] Build missing repro badge display.
- [x] Build draft reply box with mocked content.
- [x] Add responsive behavior for desktop/mobile.

### Phase 1 acceptance criteria

- [x] App runs locally.
- [x] User can navigate through the intended flow with mocked data.
- [x] Dashboard visually communicates the project value within 30 seconds.
- [x] PAT safety message is visible near the token field.

---

## Phase 2 — Database + GitHub Sync

Goal: persist repos/issues and support real GitHub issue ingestion with a PAT that is never stored server-side.

### Database setup

- [x] Add local Docker Compose Postgres + pgvector setup.
- [x] Add Postgres connection.
- [x] Enable pgvector extension for later Phase 3 embeddings.
- [x] Add Prisma.
- [x] Create initial Prisma schema.
- [x] Add `repositories` model.
- [x] Add `issues` model.
- [x] Add `issue_comments` model.
- [x] Add `issue_analyses` model.
- [x] Add `issue_embeddings` model.
- [x] Add `duplicate_candidates` model.
- [x] Add `sync_runs` model.
- [x] Add migrations.
- [x] Add seed script for basic mocked/demo data if useful. _(deferred: sample demo remains in UI mock data; real repos now persist in Postgres)_

### GitHub integration

- [x] Implement GitHub repo URL parser.
- [x] Implement PAT-safe GitHub client.
- [x] Ensure PAT is never logged.
- [x] Add PAT redaction utility.
- [x] Fetch repository metadata.
- [x] Fetch latest open issues with pagination.
- [x] Cap live import at latest 200 open issues.
- [x] Filter out pull requests from GitHub Issues API results.
- [x] Normalize issue data.
- [x] Compute issue content hash.
- [x] Upsert repository by GitHub repo ID.
- [x] Upsert issues by GitHub issue ID.
- [x] Create and update sync run records.
- [x] Display sync progress from real sync state.
- [x] Validate GitHub repo URL + PAT before full issue sync.
- [x] Add GitHub PAT creation link near token input.

### API routes / server actions

- [x] Add repo parse endpoint/action.
- [x] Add sync start endpoint/action.
- [x] Add sync status endpoint/action.
- [x] Add dashboard issues endpoint/action.
- [x] Add issue detail endpoint/action.
- [x] Add connected repositories endpoint/action.
- [x] Add persisted dashboard route at `/dashboard/[repositoryId]`.
- [x] Add connected repositories landing state at `/`.
- [x] Add Add Repo modal from connected repositories page.

### Phase 2 acceptance criteria

- [x] Local pgvector Postgres runs through Docker Compose.
- [x] Initial Prisma migration applies successfully and creates all Phase 2 tables.
- [x] User can enter repo URL + PAT and fetch real issues.
- [x] PRs are excluded.
- [x] Issues persist in Postgres.
- [x] Dashboard can render real stored issues.
- [x] Sync status and errors are visible.
- [x] PAT is not stored in the database.
- [x] Connected repositories are saved and can be reopened from `/`.
- [x] Repository dashboards have shareable URLs at `/dashboard/[repositoryId]`.

### Phase 2 implementation notes

- Local DB runtime uses `pgvector/pgvector:pg16` via `docker-compose.yml`.
- `DATABASE_URL` is documented in `.env.example`.
- Prisma is used for relational CRUD and migrations.
- The initial migration enables `CREATE EXTENSION IF NOT EXISTS vector;` for Phase 3.
- Live sync validates repo URL + PAT before fetching issues.
- PATs are held only in request/client state and are not persisted.
- GitHub `BigInt` IDs are serialized safely in API responses.
- Real synced issues currently show `Raw` severity until Phase 3 AI analysis runs.

---

## Phase 3 — AI Analysis + RAG Duplicate Detection

Goal: turn raw GitHub issues into AI-powered maintainer triage data using LLM classification and a RAG-style retrieval pipeline for semantic duplicate detection.

### AI provider architecture

- [x] Use an internal adapter interface instead of LangChain/LangGraph.
- [x] Use Vercel AI SDK behind the internal adapter implementation.
- [x] Split provider capabilities into issue analysis and issue embeddings because the text model and embedding model may come from different providers.
- [x] Add AI env configuration for text provider/model and embedding provider/model.
- [x] Add `.env.example` comments recommending OpenAI and Gemini defaults.
- [x] Add `.env.example` testing comments for DeepSeek + Voyage setup.
- [x] Implement provider wiring for OpenAI text + embeddings.
- [x] Implement provider wiring for Gemini text + embeddings.
- [x] Implement provider wiring for DeepSeek text.
- [x] Implement provider wiring for Voyage embeddings.
- [x] Document suggested OpenAI models: `gpt-5.4-mini` and `text-embedding-3-small`.
- [x] Document suggested Gemini models: `gemini-3.1-flash-lite` and `text-embedding-004`.
- [x] Document testing models: `deepseek-v4-flash` and `voyage-4-lite`.

### Severity and missing repro analysis

- [x] Define structured output schema for issue analysis.
- [x] Implement issue text normalization for LLM input.
- [x] Batch classification at 10 issues per call.
- [x] Classify severity: `critical | high | medium | low`.
- [x] Detect missing reproduction details.
- [x] Store short reasoning for severity/missing repro.
- [x] Validate LLM output.
- [x] Retry or gracefully handle malformed LLM responses.
- [x] Store analysis in `issue_analyses`.
- [x] Re-analyze only when issue content hash changes.

### RAG retrieval: embeddings and duplicates

- [x] Confirm pgvector is enabled in Postgres.
- [x] Generate embeddings from issue title + body + labels.
- [x] Batch embeddings at 50 issues per request.
- [x] Store embeddings in `issue_embeddings`.
- [x] Run same-repository vector similarity search.
- [x] Exclude self-matches.
- [x] Retrieve semantically similar issues from the same repository.
- [x] Store duplicate candidates with similarity scores.
- [x] Pick initial duplicate score threshold.
- [x] Display duplicate badges in triage queue.
- [x] Display duplicate candidates in issue detail panel.

### Dashboard integration

- [x] Sort issues by severity/urgency.
- [x] Add severity filters.
- [x] Add missing repro filter.
- [x] Add likely duplicate filter.
- [x] Show AI reasoning in detail panel.
- [x] Add degraded state if AI analysis fails but raw issues exist.

### Phase 3 acceptance criteria

- [x] Dashboard shows real severity labels.
- [x] Dashboard flags missing repro issues.
- [x] Duplicate detection uses embeddings/vector similarity as the project’s core RAG retrieval step.
- [x] Duplicate candidates are scoped to the same repo.
- [x] AI failures do not break raw issue browsing.

---

## Phase 4 — Issue Detail, Sample Demo, Polish + Deployment

Goal: make the app actionable, recruiter-friendly, and portfolio-ready.

### Issue detail and comments

- [ ] Implement bounded comment fetch for selected issue.
- [ ] Fetch either latest 10 comments or first 3 + latest 7 comments.
- [ ] Store fetched comments in `issue_comments`.
- [ ] Show comment/context loading state.
- [ ] Handle issue with no comments.

### Draft maintainer reply

- [ ] Implement lazy draft reply generation.
- [ ] Use issue title/body, labels, severity, missing repro flag, RAG-retrieved duplicate candidates, and bounded comments.
- [ ] Mark reply as AI-generated.
- [ ] Make draft editable.
- [ ] Add copy button.
- [ ] Add retry state for failed draft generation.

### Auto-sync-on-visit settings

- [ ] Add dashboard settings panel.
- [ ] Store auto-sync preference in `localStorage`.
- [ ] Do not store PAT in `localStorage`.
- [ ] If PAT is missing, prompt user to re-enter it before sync.
- [ ] Show last synced timestamp.
- [ ] Add manual Sync Now button.

### Sample demo mode

- [ ] Choose default sample repo.
- [ ] Create seed/cached sample dataset.
- [ ] Add “Try sample repo” path.
- [ ] Ensure sample demo loads quickly without PAT.
- [ ] Clearly label sample/cached data if needed.

### Polish and quality

- [ ] Add empty states.
- [ ] Add loading skeletons.
- [ ] Add partial success state.
- [ ] Add permission denied/bad PAT state.
- [ ] Add rate-limit state.
- [ ] Add mobile detail sheet.
- [ ] Check keyboard navigation.
- [ ] Check focus states.
- [ ] Check color contrast for badges.
- [ ] Add unit tests for parser, redaction, normalization, hashing, AI schema validation, duplicate threshold logic.
- [ ] Add integration tests for mocked GitHub sync and DB upserts.
- [ ] Add smoke tests for import, dashboard, detail panel, and draft reply.

### Deployment and portfolio packaging

- [ ] Deploy app.
- [ ] Add production environment variables.
- [ ] Add database migration/deploy process.
- [ ] Add README with product pitch.
- [ ] Add architecture diagram.
- [ ] Add screenshots or demo GIF.
- [ ] Add security note about PAT handling.
- [ ] Add AI/RAG pipeline explanation.
- [ ] Explain why the MVP intentionally does not use LangGraph/agent orchestration.
- [ ] Add known tradeoffs/future work.
- [ ] Prepare resume/interview demo story.

### Phase 4 acceptance criteria

- [ ] User can open an issue and generate a useful draft reply.
- [ ] Recruiter can try a sample dashboard without setup friction.
- [ ] Live repo sync still works with PAT.
- [ ] App is deployed and portfolio-ready.
- [ ] README explains the architecture and security tradeoffs clearly.
