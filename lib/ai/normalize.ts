export type IssueForAi = {
  id: string;
  number: number;
  title: string;
  body?: string | null;
  labels: string[];
  commentCount?: number;
};

export function normalizeIssueText(issue: IssueForAi) {
  const body = (issue.body ?? "").replace(/<!--([\s\S]*?)-->/g, "").replace(/\s+/g, " ").trim();
  return [
    `#${issue.number}: ${issue.title.trim()}`,
    `Labels: ${issue.labels.length ? issue.labels.join(", ") : "none"}`,
    `Comments: ${issue.commentCount ?? 0}`,
    `Body: ${body || "(empty)"}`,
  ].join("\n").slice(0, 8000);
}

export function embeddingInput(issue: IssueForAi) {
  return normalizeIssueText(issue).slice(0, 4000);
}
