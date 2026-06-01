"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, GitBranch, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type UiIssue = { sev: string; title: string; no: number; url: string; labels: string[]; comments: number; updated: string; repro: boolean; dupes: number; reason: string; dup: [number, string, string][] };
type ApiDuplicate = { score: number; targetIssue: { number: number; title: string } };
type ApiIssue = { title: string; number: number; htmlUrl: string; labels: string[]; commentCount: number; githubUpdatedAt: string; analysis?: { severity?: string | null; missingRepro?: boolean | null; severityReason?: string | null; missingReproReason?: string | null; analysisStatus?: string | null } | null; duplicateSources?: ApiDuplicate[] };
type DashboardResponse = { repository: { fullName: string; lastSyncedAt: string }; issues: ApiIssue[]; aiDegraded?: boolean };

export default function DashboardPage() {
  const { repositoryId } = useParams<{ repositoryId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState({ name: "Loading…", synced: "Loading repository dashboard" });
  const [issues, setIssues] = useState<UiIssue[]>([]);
  const [selected, setSelected] = useState<UiIssue | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [aiDegraded, setAiDegraded] = useState(false);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/dashboard/${repositoryId}`);
    const dash = await res.json() as DashboardResponse & { error?: string };
    if (!res.ok) { setError(dash.error ?? "Could not load dashboard"); return; }
    const mapped = mapDashboardIssues(dash);
    setIssues(mapped);
    setSelected(mapped[0] ?? null);
    setPage(1);
    setRepo({ name: dash.repository.fullName, synced: `Last synced ${new Date(dash.repository.lastSyncedAt).toLocaleString()} · ${mapped.length} open issues stored` });
    setAiDegraded(Boolean(dash.aiDegraded));
  }, [repositoryId]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const visibleIssues = useMemo(() => issues.filter((i) => filter === "all" || (filter === "missing" && i.repro) || (filter === "dupes" && i.dupes > 0) || i.sev.toLowerCase() === filter), [issues, filter]);
  const duplicateGroups = useMemo(() => buildDuplicateGroups(issues), [issues]);
  const pageSize = 10;
  const listCount = filter === "dupes" ? duplicateGroups.length : visibleIssues.length;
  const pageCount = Math.max(1, Math.ceil(listCount / pageSize));
  const pagedIssues = visibleIssues.slice((page - 1) * pageSize, page * pageSize);
  const pagedDuplicateGroups = duplicateGroups.slice((page - 1) * pageSize, page * pageSize);

  function changePage(nextPage: number) {
    setPage(nextPage);
    requestAnimationFrame(() => listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const summary = useMemo(() => [
    ["Critical", String(issues.filter((i) => i.sev === "Critical").length), "Likely breaking installs, builds, security, or core workflows."],
    ["High priority", String(issues.filter((i) => i.sev === "High").length), "Needs maintainer review before routine backlog work."],
    ["Missing repro", String(issues.filter((i) => i.repro).length), "Reports missing steps, environment, or a minimal reproduction."],
    ["Likely duplicates", String(issues.reduce((n, i) => n + i.dupes, 0)), "Semantic matches across recent open issues."],
  ], [issues]);

  if (error) return <main className="grid min-h-screen place-items-center p-6"><Card><CardContent className="p-8"><h1 className="font-display text-3xl font-bold">Dashboard unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Button className="mt-5" onClick={() => router.push("/")}>Back to repositories</Button></CardContent></Card></main>;
  if (!selected) return <main className="grid min-h-screen place-items-center p-6"><Card><CardContent className="p-8">Loading dashboard…</CardContent></Card></main>;

  return <main className="mx-auto min-h-screen max-w-[1500px] p-4 md:p-7"><header className="mb-5 grid items-center gap-4 rounded-3xl border bg-[#fffaf0]/75 p-5 shadow-sm backdrop-blur md:grid-cols-[180px_1fr_180px]"><div className="flex justify-start"><Button variant="ghost" size="icon" aria-label="Back to repositories" onClick={() => router.push("/")}><ArrowLeft className="h-5 w-5" /></Button></div><div className="text-center"><Badge variant="outline"><GitBranch className="mr-1 h-3 w-3" /> Connected repo</Badge><h1 className="mt-2 font-display text-4xl font-bold">{repo.name}</h1><p className="text-muted-foreground">{repo.synced}</p></div><div className="flex justify-end"><Button variant="outline" onClick={loadDashboard}><RefreshCcw className="h-4 w-4" /> Sync now</Button></div></header><section className="grid gap-4 md:grid-cols-4">{summary.map(([name,count,copy]) => <Card key={name} className="bg-white/65"><CardContent className="p-5"><div className="text-sm font-semibold text-muted-foreground">{name}</div><div className="font-display text-5xl font-bold">{count}</div><p className="mt-2 text-sm text-muted-foreground">{copy}</p></CardContent></Card>)}</section><section className="mt-5 grid gap-5 lg:grid-cols-[1fr_470px]"><Card className="bg-[#fffaf0]/80"><CardContent className="p-5"><div ref={listTopRef} />{aiDegraded && <div className="mb-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">AI analysis is degraded or incomplete. Raw issue browsing remains available.</div>}<div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl font-bold">Triage Queue</h2><div className="flex flex-wrap gap-2">{["all","critical","high","medium","low","missing","dupes"].map(f => <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => { setFilter(f); setPage(1); }}>{f}</Button>)}</div><div className="relative hidden sm:block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search issues" /></div></div>{filter === "dupes" ? <div className="space-y-3">{pagedDuplicateGroups.map((group, index) => <div key={group.map((issue) => issue.no).join("-")} className="rounded-2xl border bg-white/70 p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><Badge variant="outline" className="bg-white">Duplicate group {(page - 1) * pageSize + index + 1}</Badge><h3 className="mt-2 font-semibold">{group.length} similar issues</h3></div><Badge className="bg-slate-950">Likely same root cause</Badge></div><div className="space-y-2">{group.map((issue) => <button key={issue.no} onClick={() => setSelected(issue)} className={`w-full rounded-xl border p-3 text-left transition hover:shadow-sm ${selected.no === issue.no ? "bg-slate-950 text-white" : "bg-white/80"}`}><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">#{issue.no} {issue.title}</span><Severity sev={issue.sev} /></div><p className="mt-1 text-xs opacity-70">{issue.dupes} semantic matches · updated {issue.updated}</p></button>)}</div></div>)}</div> : <div className="space-y-3">{pagedIssues.map(issue => <button key={issue.no} onClick={() => setSelected(issue)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected.no === issue.no ? "bg-slate-950 text-white" : "bg-white/70"}`}><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{issue.title} <span className="opacity-65">#{issue.no}</span></h3><Severity sev={issue.sev} /></div><p className="mt-2 text-sm opacity-75">{issue.labels.join(" · ") || "no labels"} · {issue.comments} comments · updated {issue.updated}</p><p className="mt-3 text-sm opacity-80">Reason: {issue.reason}</p></button>)}</div>}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground"><span>Showing {listCount ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, listCount)} of {listCount} {filter === "dupes" ? "duplicate groups" : "issues"}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))}>Previous</Button><span>Page {page} / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => changePage(Math.min(pageCount, page + 1))}>Next</Button></div></div></CardContent></Card><aside className="lg:sticky lg:top-7 lg:h-[calc(100vh-3.5rem)]"><Card className="h-full overflow-hidden bg-slate-950 text-slate-50 shadow-radar"><CardContent className="flex h-full flex-col gap-5 overflow-auto p-6"><Severity sev={selected.sev} /><h2 className="font-display text-3xl font-bold">{selected.title}</h2><p className="text-slate-300">#{selected.no} · updated {selected.updated}</p><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"><ExternalLink className="h-4 w-4" /> Open issue on GitHub</a><Panel title={`Why this is ${selected.sev.toLowerCase()} priority`}> {selected.reason}{selected.repro && <p className="mt-3 rounded-lg bg-yellow-400/10 p-2 text-yellow-100">Missing reproduction details detected.</p>}</Panel><Panel title="Likely duplicates"><div className="space-y-2">{selected.dup.length ? selected.dup.map(d => <div key={d[0]} className="rounded-xl bg-white/10 p-3">#{d[0]} {d[1]} — <b>{d[2]}</b> similarity</div>) : "Duplicate detection starts in Phase 3."}</div></Panel><Panel title="Draft maintainer reply"><p className="mb-2 text-xs text-slate-400">AI-generated draft. Review before posting to GitHub.</p><Textarea className="border-white/15 bg-white/10 text-slate-50" defaultValue={`Thanks for the report. This issue has been synced into IssueScope. ${selected.reason}`} /><Button className="mt-3 bg-teal-600 hover:bg-teal-500"><Copy className="h-4 w-4" /> Copy draft</Button></Panel></CardContent></Card></aside></section></main>;
}

function mapDashboardIssues(dash: DashboardResponse) { return dash.issues.map((i): UiIssue => { const sev = i.analysis?.severity ? i.analysis.severity[0].toUpperCase() + i.analysis.severity.slice(1) : "Raw"; return { sev, title: i.title, no: i.number, url: i.htmlUrl, labels: i.labels, comments: i.commentCount, updated: new Date(i.githubUpdatedAt).toLocaleString(), repro: Boolean(i.analysis?.missingRepro), dupes: i.duplicateSources?.length ?? 0, reason: i.analysis?.severityReason ?? "Raw GitHub issue synced. AI analysis is unavailable or pending.", dup: (i.duplicateSources ?? []).map((d) => [d.targetIssue.number, d.targetIssue.title, d.score.toFixed(2)]) }; }); }

function buildDuplicateGroups(issues: UiIssue[]) {
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
  const groups: UiIssue[][] = [];
  for (const issueNumber of graph.keys()) {
    if (seen.has(issueNumber)) continue;
    const stack = [issueNumber];
    const group: UiIssue[] = [];
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

function severityWeight(sev: string) { return sev === "Critical" ? 0 : sev === "High" ? 1 : sev === "Medium" ? 2 : sev === "Low" ? 3 : 9; }
function Severity({ sev }: { sev: string }) { const cls = sev === "Critical" ? "bg-red-700" : sev === "High" ? "bg-orange-600" : sev === "Raw" ? "bg-slate-600" : sev === "Low" ? "bg-emerald-700" : "bg-yellow-600"; return <Badge className={cls}><AlertTriangle className="mr-1 h-3 w-3" />{sev}</Badge>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><h3 className="mb-2 font-semibold text-white">{title}</h3><div className="text-sm leading-6 text-slate-300">{children}</div></section>; }
