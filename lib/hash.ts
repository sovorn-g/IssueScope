import { createHash } from "crypto";

export function issueContentHash(input: { title: string; body?: string | null; labels?: string[] }) {
  return createHash("sha256")
    .update(JSON.stringify({ title: input.title, body: input.body ?? "", labels: [...(input.labels ?? [])].sort() }))
    .digest("hex");
}
