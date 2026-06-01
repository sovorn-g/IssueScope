# IssueScope / Maintainer Radar — Design Plan

## Design Goal

IssueScope should feel like a polished maintainer command center, not a generic AI dashboard. The first impression should be clear, trustworthy, and immediately useful:

> Paste a public GitHub repo URL, provide a GitHub PAT, sync issues, and see which issues need maintainer attention first.

The UI should impress two audiences:

1. Recruiters and hiring managers who need to understand the value quickly.
2. Senior engineer interviewers who will look for thoughtful product, security, and system design decisions.

## Design Direction

Use **Option B: Polished Product Direction**.

Design concept:

> Maintainer command center for GitHub issue triage.

Core UX principles:

- Show value fast.
- Make PAT/security handling feel safe and explicit.
- Prioritize maintainer urgency over generic issue browsing.
- Explain AI decisions enough to build trust.
- Keep the UI clean, structured, and portfolio-ready.



## AI/RAG Product Framing

The product should describe its intelligence clearly:

- LLM classification ranks issue severity and flags missing reproduction details.
- RAG-style retrieval powers semantic duplicate detection by embedding issues and retrieving similar issues from the same repository.
- Reply drafting can use retrieved duplicate candidates and bounded comments as context.

Avoid presenting the app as an autonomous agent or chatbot. The MVP is a deterministic maintainer workflow, not a LangGraph-style agent system.

## Primary User Journey

```text
Landing / Import
  ↓
Sync + Analysis Progress
  ↓
Dashboard / Triage Queue
  ↓
Issue Detail Panel
  ↓
Draft Reply / Copy Action
```

## User Behavior Reality Check

The user is trying to answer:

> “Which GitHub issues should I look at first, and what should I do with them?”

They should see:

1. **First:** A clear import/demo choice.
2. **Second:** A trustworthy sync process with visible stages.
3. **Third:** A ranked dashboard focused on severity, duplicates, and missing repro details.
4. **Fourth:** An actionable issue detail panel with explanation and draft reply.

What must be obvious without explanation:

- A GitHub PAT is required for live sync.
- The PAT is used only for sync and is never stored server-side.
- The app analyzes GitHub issues, not source code.
- Issues are ranked by maintainer urgency.
- Duplicate detection is semantic, not just keyword matching.
- AI-generated replies are drafts that the maintainer can edit/copy.

Potential stuck points:

- User is nervous about entering a PAT.
- Sync takes too long and appears frozen.
- Imported repo has no open issues.
- AI severity labels feel arbitrary.
- Duplicate scores feel magical or untrustworthy.
- PAT is missing on revisit and auto-sync cannot run.

Emotional states:

- Recruiter: curious, impatient, looking for a fast “wow.”
- Senior engineer: skeptical, evaluating architecture and edge cases.
- Maintainer: rushed, wanting actionable prioritization.

## Information Architecture

### 1. Landing / Import Page

Purpose:

- Explain what the product does.
- Let users start quickly.
- Build trust around PAT handling.

Primary sections:

- Hero
- Sample demo CTA
- Live repo import form
- Security note
- Feature preview

Recommended layout:

```text
[Hero]
AI issue triage for open-source maintainers
Rank severity, detect duplicates, flag missing repros, and draft replies.

[Primary CTA] Try sample repo
[Secondary CTA/Form] Analyze GitHub repo

Repo URL input
GitHub PAT input
Security note
Start analysis button
```

Recommended hero copy:

> AI issue triage for open-source maintainers.

Supporting copy:

> Paste a public GitHub repo, sync the latest issues, and get a ranked triage queue with severity, semantic duplicates, missing repro flags, and draft maintainer replies.

PAT microcopy:

> Your token is used only for this sync request/session and is never stored on our server.

Secondary PAT note:

> Use a fine-grained GitHub token with read-only access for public repository metadata and issues.

### 2. Sync / Analysis Progress Screen

Purpose:

- Keep users confident while GitHub/AI processing runs.
- Show that real work is happening.

Progress stages:

```text
Connecting to GitHub
Fetching repository metadata
Fetching latest open issues
Filtering pull requests
Classifying severity
Detecting missing repro details
Generating issue embeddings
Finding semantic duplicates
Preparing dashboard
```

Recommended UI:

- Card centered on page or modal-like panel.
- Step list with status icons: pending, active, complete, failed.
- Progress count: `120 / 200 issues processed`.
- Last message area for non-secret errors.
- Button to retry if failed.

Slow sync copy:

> Large repositories can take a minute or two. You can keep this tab open while IssueScope prepares the dashboard.

Partial success copy:

> We synced the issues but some AI analysis failed. You can view the dashboard now and retry analysis later.

### 3. Dashboard / Triage Queue

Purpose:

- Deliver the main “whoa” moment.
- Make maintainer priority obvious.

Recommended desktop layout:

```text
[Top bar]
Repo name        Last synced X hours ago     Sync Now     Settings

[Summary cards]
Critical issues | High priority | Missing repro | Likely duplicates

[Main content]
Left / center: Triage Queue
Right: Issue Detail Panel or empty detail prompt
```

Dashboard hierarchy:

1. Repo identity and sync freshness.
2. Severity summary cards.
3. Ranked triage queue.
4. Filters/search.
5. Detail panel.

### Summary Cards

Cards:

- Critical
- High Priority
- Missing Repro
- Likely Duplicates

Each card should show:

- count
- short label
- subtle explanatory text

Example:

```text
Critical
4
Likely breaking installs, builds, security, or core workflows.
```

### Triage Queue

Issue list should be ranked by severity/urgency, not by newest.

Each issue row/card should show:

- severity badge
- issue title
- issue number
- labels
- missing repro badge if true
- duplicate badge if candidates exist
- comment count
- updated timestamp
- short AI reason if space allows

Example row:

```text
[High] Hydration error after upgrading to 15.1  #71234
Bug · React 19 · 8 comments · updated 2h ago
Missing repro · 3 likely duplicates
Reason: Affects upgrade path and has multiple confirmations.
```

### Filters

Minimum filters:

- All
- Critical
- High
- Missing repro
- Likely duplicates

Optional filters:

- Label
- Search issue title/body
- Sort by severity / updated / comments

### 4. Issue Detail Panel

Purpose:

- Explain why the issue is prioritized.
- Show duplicate candidates.
- Generate a useful maintainer reply.

Desktop behavior:

- Right-side panel or drawer.
- Opens when user selects an issue.
- Keeps triage queue visible.

Mobile behavior:

- Full-screen sheet/dialog.
- Back button returns to issue list.

Detail panel sections:

1. Issue header
2. Severity explanation
3. Missing repro analysis
4. Likely duplicates
5. Comments/context status
6. Draft maintainer reply

Example structure:

```text
[High] Hydration error after upgrading to 15.1
#71234 · opened by @user · updated 2h ago

Why this is high priority
Affects upgrade path and has multiple confirmations.

Missing repro
This issue does not include a minimal reproduction link or steps.

Likely duplicates
- #71002 Similar hydration mismatch after React 19 upgrade — 0.87
- #70991 Client/server mismatch on nested layout — 0.81

Draft maintainer reply
[Generate draft]
```

Draft reply behavior:

- Generate lazily when user clicks button or opens the section.
- Show loading state.
- Output should be editable or copyable.
- Include copy button.
- Mark clearly as AI-generated.

Draft reply microcopy:

> AI-generated draft. Review before posting to GitHub.

## Visual Hierarchy

Priority order:

1. Severity and maintainer urgency.
2. Issue title and context.
3. Duplicate/missing repro badges.
4. Explanation/reasoning.
5. Metadata.

Severity badge recommendations:

- Critical: red/destructive
- High: orange/warning
- Medium: yellow/secondary warning
- Low: muted/neutral

Keep colors accessible and do not rely on color alone. Include text labels.

## Component Plan

Use shadcn/ui components where possible.

Recommended components:

- `Button`
- `Input`
- `Card`
- `Badge`
- `Alert`
- `Tabs`
- `Table` or custom card list
- `Sheet` / `Drawer`
- `Dialog`
- `Progress`
- `Skeleton`
- `Tooltip`
- `Textarea`
- `Separator`
- `DropdownMenu`
- `Switch`

Suggested custom components:

```text
RepoImportForm
PatSafetyNote
SyncProgressCard
SeveritySummaryCards
TriageQueue
IssueRow
SeverityBadge
MissingReproBadge
DuplicateBadge
IssueDetailPanel
DuplicateCandidatesList
DraftReplyBox
AutoSyncSettings
EmptyState
ErrorState
```

## Interaction States

### First-Run / Empty State

Show two obvious paths:

- Try sample repo
- Analyze GitHub repo

Empty state copy:

> Start by analyzing a public GitHub repository or try the sample dashboard.

### PAT Required State

If the user tries live sync without PAT:

> A GitHub token is required for live sync so IssueScope can reliably read issues without hitting low rate limits.

Action:

- Focus PAT field.
- Show PAT safety note.

### Loading / Progress State

Show staged progress, not only a spinner.

Minimum visible data:

- current step
- issues fetched
- issues analyzed
- elapsed time or friendly waiting copy

### Slow Network / Timeout

Copy:

> GitHub or AI processing is taking longer than expected. You can keep waiting or retry the sync.

Actions:

- Retry
- Return to previous dashboard if available

### Permission Denied / Bad PAT

Copy:

> GitHub rejected this token. Check that it is valid and has read access to the repository issues.

Actions:

- Re-enter token
- Open GitHub token help link

### Rate Limited

Copy:

> GitHub rate limited this token. Try again after the reset time or use a different token.

Show reset time if available.

### Partial Success

Copy:

> Issues were synced, but some AI analysis failed. You can view the dashboard now and retry analysis.

Actions:

- View dashboard
- Retry failed analysis

### No Open Issues

Copy:

> This repository has no open issues to triage.

Actions:

- Analyze another repo
- Try sample repo

### AI Analysis Failed

Dashboard should degrade gracefully.

If severity unavailable:

- Show issue list with neutral status.
- Show banner: `AI analysis failed. Raw issues are still available.`
- Offer retry.

### Duplicate Detection Unavailable

- Hide duplicate badges or show muted unavailable state.
- Do not block dashboard.

### Issue Detail Loading

Use skeleton sections for:

- issue metadata
- duplicate list
- reply draft area

### Draft Reply Loading

Button state:

> Drafting reply…

Disable duplicate clicks.

### Draft Reply Failed

Copy:

> Could not generate a reply draft. Try again.

Actions:

- Retry
- Copy issue context manually

### Long Issue Body / Comments

- Collapse long body with “Show more.”
- Limit comments shown by default.
- Use scrollable detail panel.

### Destructive Actions

MVP has no destructive GitHub writes.

If later adding write actions, require explicit confirmation.

## Responsiveness

### Desktop

Recommended layout:

- Max width container or full dashboard shell.
- Summary cards in 4-column grid.
- Triage queue in main area.
- Detail panel fixed/sticky on right.

### Tablet

- Summary cards in 2-column grid.
- Issue list full width.
- Detail panel opens as sheet.

### Mobile

- Summary cards in 2-column or horizontal scroll.
- Issues rendered as cards, not dense table rows.
- Detail panel opens full-screen.
- Filters collapse into dropdown/sheet.

## Accessibility Requirements

- All form fields must have visible labels.
- PAT visibility toggle must have accessible label.
- Do not rely on color alone for severity.
- Badges must include text.
- Issue rows must be keyboard selectable.
- Detail sheet/dialog must trap focus and return focus on close.
- Buttons must show focus states.
- Loading/progress updates should use accessible status regions where practical.
- Error messages should be associated with the relevant field.
- Color contrast should meet WCAG AA.

## Copy Guidelines

Tone:

- Clear
- Calm
- Technical but approachable
- Specific to maintainers

Avoid generic phrases like:

- “AI-powered insights”
- “Unlock productivity”
- “Supercharge your workflow”

Prefer specific phrases:

- “Rank open issues by maintainer urgency.”
- “Find semantic duplicates across recent issues.”
- “Flag reports missing reproduction steps.”
- “Draft a maintainer reply you can edit before posting.”

## Trust and Security Copy

PAT field helper text:

> Required for live sync. Used only for GitHub API requests and never stored on our server.

Session note:

> If you close this tab or clear the session, you may need to enter the token again to sync.

Settings note:

> Auto-sync runs only when you revisit this dashboard and your token is available in the active browser session.

Footer/security note:

> IssueScope stores fetched issue data and AI analysis, but not GitHub tokens.

## AI Explainability Requirements

Every AI-driven UI element should have enough context to avoid feeling magical.

Severity:

- Show badge in row.
- Show short reason in detail panel.

Missing repro:

- Show badge in row if missing.
- Detail panel should explain what appears missing, e.g. steps, environment, minimal reproduction link.

Duplicates:

- Show candidate issue number/title.
- Show similarity score or confidence label.
- Link to GitHub issue.

Draft reply:

- Mark as AI-generated.
- Make editable/copyable.
- Never imply it was posted automatically.

## AI-Slop Avoidance

The app should feel specific to GitHub maintainers.

Use product-specific nouns:

- triage queue
- missing repro
- duplicate candidates
- maintainer reply
- issue severity
- sync run
- open issues

Avoid making the UI look like a generic chat assistant or generic dashboard.

## Rough Wireframes

### Landing Page

```text
┌────────────────────────────────────────────────────────────┐
│ IssueScope                                                 │
│ AI issue triage for open-source maintainers.               │
│                                                            │
│ Rank severity, detect semantic duplicates, flag missing    │
│ repros, and draft maintainer replies.                      │
│                                                            │
│ [Try sample repo]                                          │
│                                                            │
│ Analyze a GitHub repo                                      │
│ Repo URL                                                   │
│ [https://github.com/vercel/next.js                    ]    │
│ GitHub PAT                                                 │
│ [••••••••••••••••••••••••••                         ] [👁] │
│ Required for live sync. Used only for GitHub API requests  │
│ and never stored on our server.                            │
│                                                            │
│ [Start analysis]                                           │
└────────────────────────────────────────────────────────────┘
```

### Sync Progress

```text
┌────────────────────────────────────────────────────────────┐
│ Preparing maintainer radar for vercel/next.js              │
│                                                            │
│ ✓ Connecting to GitHub                                     │
│ ✓ Fetching repository metadata                             │
│ ✓ Fetching latest open issues                              │
│ → Classifying severity                                     │
│ ○ Generating issue embeddings                              │
│ ○ Finding semantic duplicates                              │
│ ○ Preparing dashboard                                      │
│                                                            │
│ 120 / 200 issues processed                                 │
└────────────────────────────────────────────────────────────┘
```

### Dashboard Desktop

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ vercel/next.js                         Last synced 2h ago  [Sync Now] [⚙] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Critical 4] [High 18] [Missing repro 32] [Likely duplicates 12]           │
├─────────────────────────────────────────────┬───────────────────────────────┤
│ Triage Queue                                │ Issue Detail                  │
│                                             │                               │
│ [High] Hydration error after upgrade #71234 │ High priority                 │
│ Bug · 8 comments · updated 2h ago           │ Affects upgrade path...        │
│ Missing repro · 3 likely duplicates         │                               │
│                                             │ Missing repro                  │
│ [Medium] Build fails on Windows #71210      │ No minimal reproduction link.  │
│ Regression · 4 comments                     │                               │
│ 1 likely duplicate                          │ Likely duplicates             │
│                                             │ #71002 — 0.87 similarity       │
│                                             │ #70991 — 0.81 similarity       │
│                                             │                               │
│                                             │ Draft maintainer reply         │
│                                             │ [Generate draft]               │
└─────────────────────────────────────────────┴───────────────────────────────┘
```

## Design Scorecard

| Area | Current Plan Score | Target |
| --- | ---: | ---: |
| Information architecture | 7/10 | 9/10 |
| Visual hierarchy | 6/10 | 9/10 |
| Interaction state coverage | 6/10 | 9/10 |
| User journey and emotional arc | 8/10 | 9/10 |
| Copy clarity / microcopy | 6/10 | 9/10 |
| Trust and credibility | 7/10 | 9/10 |
| Design-system alignment | 7/10 | 9/10 |
| Responsiveness | 5/10 | 8/10 |
| Accessibility | 5/10 | 8/10 |
| AI-slop risk / genericness | 6/10 | 9/10 |

## Design Risks

### Risk: PAT input scares users

Mitigation:

- Put safety copy directly under field.
- Explain no server-side token storage.
- Use password input with visibility toggle.
- Link to fine-grained PAT docs later.

### Risk: Dashboard feels generic

Mitigation:

- Use maintainer-specific terminology.
- Lead with triage queue and severity summary.
- Avoid generic “AI insights” cards.

### Risk: AI labels feel arbitrary

Mitigation:

- Store and show short reasoning.
- Show duplicate scores/confidence.
- Make reply drafts editable/copyable.

### Risk: Slow sync loses user trust

Mitigation:

- Use staged progress.
- Show issue counts.
- Provide retry/recovery actions.

## Implementation Notes for UI Build

Recommended first UI milestone:

1. Build landing/import page with mocked submit.
2. Build sync progress screen with fake staged progress.
3. Build dashboard with realistic mocked issue data.
4. Build issue detail panel with mocked duplicate/reply states.
5. Only then connect real backend data.

This lets the portfolio story become visible early and prevents backend complexity from delaying the main user experience.

## Final Design Recommendation

Proceed with the **maintainer command-center** design direction.

Before implementation, make sure the first mocked dashboard already demonstrates the full story:

- repo name
- last synced timestamp
- severity cards
- ranked triage queue
- missing repro badges
- duplicate candidates
- issue detail explanation
- draft reply CTA
