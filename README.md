# IssueScope

Maintainer radar for GitHub issues. Paste a public repository URL, provide a GitHub PAT for live sync, and get a ranked triage queue with severity, missing repro flags, semantic duplicate candidates, and draft maintainer replies.

## Phase 1

Static Next.js product demo with mocked data.

```bash
npm install
npm run dev
```

## Security principle

GitHub tokens are used only for sync requests and are not stored server-side.
