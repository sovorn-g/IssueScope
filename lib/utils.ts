import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type HasDuplicateEdges = { no: number; sev: string; dupes: number; dup: [number, string, string][] };

/** Build connected components from duplicate-candidate edges via DFS.
 *  Preserves the full input object type so callers can access all fields. */
export function buildDuplicateGroups<T extends HasDuplicateEdges>(issues: T[]): T[][] {
  const byNumber = new Map(issues.map((issue) => [issue.no, issue]));
  const graph = new Map<number, Set<number>>();
  for (const issue of issues) {
    if (!issue.dupes) continue;
    if (!graph.has(issue.no)) graph.set(issue.no, new Set());
    for (const [targetNumber] of issue.dup) {
      if (!byNumber.has(targetNumber)) continue;
      graph.get(issue.no)!.add(targetNumber);
      if (!graph.has(targetNumber)) graph.set(targetNumber, new Set());
      graph.get(targetNumber)!.add(issue.no);
    }
  }
  const seen = new Set<number>();
  const groups: T[][] = [];
  for (const issueNumber of graph.keys()) {
    if (seen.has(issueNumber)) continue;
    const stack = [issueNumber];
    const group: T[] = [];
    seen.add(issueNumber);
    while (stack.length) {
      const current = stack.pop()!;
      const issue = byNumber.get(current);
      if (issue) group.push(issue);
      for (const next of graph.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    if (group.length > 1) groups.push(group.sort((a, b) => severityWeight(a.sev) - severityWeight(b.sev) || b.dupes - a.dupes));
  }
  return groups.sort((a, b) => b.length - a.length || severityWeight(a[0].sev) - severityWeight(b[0].sev));
}

function severityWeight(sev: string) {
  return sev === "Critical" ? 0 : sev === "High" ? 1 : sev === "Medium" ? 2 : sev === "Low" ? 3 : 9;
}
