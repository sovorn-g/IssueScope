"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, Eye, EyeOff, GitBranch, Loader2, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildDuplicateGroups } from "@/lib/utils";

type UiIssue = { sev: string; title: string; no: number; url: string; body: string; labels: string[]; comments: number; updated: string; repro: boolean; dupes: number; reason: string; dup: [number, string, string][] };
type ApiDuplicate = { score: number; targetIssue: { number: number; title: string } };
type ApiIssue = { title: string; number: number; htmlUrl: string; body?: string | null; labels: string[]; commentCount: number; githubUpdatedAt: string; analysis?: { severity?: string | null; missingRepro?: boolean | null; severityReason?: string | null; missingReproReason?: string | null; analysisStatus?: string | null } | null; duplicateSources?: ApiDuplicate[] };
type DashboardResponse = { repository: { fullName: string; lastSyncedAt: string }; issues: ApiIssue[]; aiDegraded?: boolean };
type SyncReport = { fetched: number; inserted: number; updated: number; pruned: number; aiError?: string | null };

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
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
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


  async function startResync() {
    if (!pat.trim()) {
      setSyncError("A GitHub token is required to re-sync from GitHub.");
      return;
    }
    setSyncError("");
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, pat }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const ingest = data.ingest as SyncReport | undefined;
      if (ingest) setSyncReport({ ...ingest, aiError: data.aiError ?? null });
      setShowSyncModal(false);
      setPat("");
      await loadDashboard();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

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
    ["High", String(issues.filter((i) => i.sev === "High").length), "Needs maintainer review before routine backlog work."],
    ["Medium", String(issues.filter((i) => i.sev === "Medium").length), "Moderate impact or limited scope; ok to schedule."],
    ["Low", String(issues.filter((i) => i.sev === "Low").length), "Nice-to-have or cosmetic; no urgency."],
    ["Missing repro", String(issues.filter((i) => i.repro).length), "Reports missing steps, environment, or a minimal reproduction."],
  ], [issues]);

  if (error) return <main className="grid min-h-screen place-items-center p-6"><Card><CardContent className="p-8"><h1 className="font-display text-3xl font-bold">Dashboard unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Button className="mt-5" onClick={() => router.push("/")}>Back to repositories</Button></CardContent></Card></main>;
  if (!selected) return <main className="grid min-h-screen place-items-center p-6"><Card><CardContent className="p-8">Loading dashboard…</CardContent></Card></main>;

  return <main className="mx-auto min-h-screen max-w-[1500px] p-4 md:p-7"><header className="mb-5 grid items-center gap-4 rounded-3xl border bg-[#fffaf0]/75 p-5 shadow-sm backdrop-blur md:grid-cols-[180px_1fr_180px]"><div className="flex justify-start"><Button variant="ghost" size="icon" aria-label="Back to repositories" onClick={() => router.push("/")}><ArrowLeft className="h-5 w-5" /></Button></div><div className="text-center"><Badge variant="outline"><GitBranch className="mr-1 h-3 w-3" /> Connected repo</Badge><h1 className="mt-2 font-display text-4xl font-bold">{repo.name}</h1><p className="text-muted-foreground">{repo.synced}</p></div><div className="flex justify-end"><Button variant="outline" onClick={() => { setSyncError(""); setShowSyncModal(true); }} disabled={syncing}><RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync now"}</Button></div></header><section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{summary.map(([name,count,copy]) => <Card key={name} className="bg-white/65"><CardContent className="p-5"><div className="text-sm font-semibold text-muted-foreground">{name}</div><div className="font-display text-5xl font-bold">{count}</div><p className="mt-2 text-sm text-muted-foreground">{copy}</p></CardContent></Card>)}</section><section className="mt-5 grid gap-5 lg:grid-cols-[1fr_470px]"><Card className="bg-[#fffaf0]/80"><CardContent className="p-5"><div ref={listTopRef} />{aiDegraded && <div className="mb-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">AI analysis is degraded or incomplete. Raw issue browsing remains available.</div>}<div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl font-bold">Triage Queue</h2><div className="flex flex-wrap gap-2">{["all","critical","high","medium","low","missing","dupes"].map(f => <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => { setFilter(f); setPage(1); }}>{f}</Button>)}</div><div className="relative hidden sm:block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search issues" /></div></div>{filter === "dupes" ? <div className="space-y-3">{pagedDuplicateGroups.map((group, index) => <div key={group.map((issue) => issue.no).join("-")} className="rounded-2xl border bg-white/70 p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><Badge variant="outline" className="bg-white">Duplicate group {(page - 1) * pageSize + index + 1}</Badge><h3 className="mt-2 font-semibold">{group.length} similar issues</h3></div><Badge className="bg-slate-950">Likely same root cause</Badge></div><div className="space-y-2">{group.map((issue) => <button key={issue.no} onClick={() => setSelected(issue)} className={`w-full rounded-xl border p-3 text-left transition hover:shadow-sm ${selected.no === issue.no ? "bg-slate-950 text-white" : "bg-white/80"}`}><div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">#{issue.no} {issue.title}</span><Severity sev={issue.sev} /></div><p className="mt-1 text-xs opacity-70">{issue.dupes} semantic matches · updated {issue.updated}</p></button>)}</div></div>)}</div> : <div className="space-y-3">{pagedIssues.map(issue => <button key={issue.no} onClick={() => setSelected(issue)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected.no === issue.no ? "bg-slate-950 text-white" : "bg-white/70"}`}><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{issue.title} <span className="opacity-65">#{issue.no}</span></h3><Severity sev={issue.sev} /></div><p className="mt-2 text-sm opacity-75">{issue.labels.join(" · ") || "no labels"} · {issue.comments} comments · updated {issue.updated}</p><p className="mt-3 text-sm opacity-80">Reason: {issue.reason}</p></button>)}</div>}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground"><span>Showing {listCount ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, listCount)} of {listCount} {filter === "dupes" ? "duplicate groups" : "issues"}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))}>Previous</Button><span>Page {page} / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => changePage(Math.min(pageCount, page + 1))}>Next</Button></div></div></CardContent></Card><aside className="lg:sticky lg:top-7 lg:h-[calc(100vh-3.5rem)]"><Card className="h-full overflow-hidden bg-slate-950 text-slate-50 shadow-radar"><CardContent className="flex h-full flex-col gap-5 overflow-auto p-6"><Severity sev={selected.sev} /><h2 className="font-display text-3xl font-bold">{selected.title}</h2><p className="text-slate-300">#{selected.no} · updated {selected.updated}</p><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"><ExternalLink className="h-4 w-4" /> Open issue on GitHub</a><Panel title="Issue description"><div className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed opacity-85">{selected.body || "No description provided."}</div></Panel><Panel title={`Why this is ${selected.sev.toLowerCase()} priority`}> {selected.reason}{selected.repro && <p className="mt-3 rounded-lg bg-yellow-400/10 p-2 text-yellow-100">Missing reproduction details detected.</p>}</Panel><Panel title="Likely duplicates"><div className="space-y-2">{selected.dup.length ? selected.dup.map(d => <button key={d[0]} onClick={() => { const match = issues.find(i => i.no === d[0]); if (match) setSelected(match); }} className="w-full rounded-xl bg-white/10 p-3 text-left transition hover:bg-white/20">#{d[0]} {d[1]} — <b>{d[2]}</b> similarity</button>) : "No similar issues detected."}</div></Panel></CardContent></Card></aside></section>{showSyncModal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="resync-title"><Card className="w-full max-w-md bg-[#fffaf0] text-slate-950 shadow-radar"><CardContent className="p-6"><h2 id="resync-title" className="font-display text-3xl font-bold">Re-sync from GitHub</h2><p className="mt-3 text-sm leading-6 text-slate-600">Fetch the latest 200 open issues, remove closed or stale rows, and re-run AI triage. Your token is used only for this request.</p><label className="mt-5 block text-sm font-semibold">GitHub PAT<div className="mt-2 flex gap-2"><Input type={showPat ? "text" : "password"} value={pat} onChange={(e) => setPat(e.target.value)} placeholder="github_pat_••••••••••" disabled={syncing} /><Button variant="outline" size="icon" aria-label="Toggle PAT visibility" onClick={() => setShowPat((v) => !v)} disabled={syncing}>{showPat ? <EyeOff /> : <Eye />}</Button></div></label>{syncError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{syncError}</div>}{syncing && <div className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Syncing issues and running AI analysis…</div>}<div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => { if (!syncing) { setShowSyncModal(false); setSyncError(""); } }} disabled={syncing}>Cancel</Button><Button onClick={() => void startResync()} disabled={syncing}>{syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Syncing…</> : "Start sync"}</Button></div></CardContent></Card></div>}{syncReport && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sync-report-title"><Card className="w-full max-w-lg bg-[#fffaf0] text-slate-950 shadow-radar"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><Badge variant="outline" className="bg-white">Sync report</Badge><h2 id="sync-report-title" className="mt-2 font-display text-3xl font-bold">Sync complete</h2><p className="mt-2 text-sm text-slate-600">Latest GitHub issue state has been reconciled with the dashboard.</p></div><button aria-label="Close sync report" onClick={() => setSyncReport(null)} className="rounded-full border bg-white px-3 py-1 text-lg leading-none text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><ReportStat label="Open issues fetched" value={syncReport.fetched} tone="neutral" /><ReportStat label="New issues added" value={syncReport.inserted} tone="good" /><ReportStat label="Existing issues refreshed" value={syncReport.updated} tone="neutral" /><ReportStat label="Closed/stale issues deleted" value={syncReport.pruned} tone={syncReport.pruned > 0 ? "warn" : "neutral"} /></div><div className={`mt-5 rounded-2xl border p-4 text-sm ${syncReport.aiError ? "border-yellow-300 bg-yellow-50 text-yellow-900" : "border-green-300 bg-green-50 text-green-900"}`}><b>{syncReport.aiError ? "AI analysis partially degraded" : "AI analysis up to date"}</b><p className="mt-1">{syncReport.aiError ? syncReport.aiError : "Only new or changed issue content triggers analysis and embeddings."}</p></div><div className="mt-6 flex justify-end"><Button onClick={() => setSyncReport(null)}>Done</Button></div></CardContent></Card></div>}</main>;
}

function ReportStat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "neutral" }) { const cls = tone === "good" ? "border-green-200 bg-green-50" : tone === "warn" ? "border-yellow-200 bg-yellow-50" : "border-slate-200 bg-white"; return <div className={`rounded-2xl border p-4 ${cls}`}><div className="text-sm font-semibold text-slate-600">{label}</div><div className="mt-1 font-display text-4xl font-bold">{value}</div></div>; }

function mapDashboardIssues(dash: DashboardResponse) { return dash.issues.map((i): UiIssue => { const sev = i.analysis?.severity ? i.analysis.severity[0].toUpperCase() + i.analysis.severity.slice(1) : "Raw"; return { sev, title: i.title, no: i.number, url: i.htmlUrl, body: i.body ?? "", labels: i.labels, comments: i.commentCount, updated: new Date(i.githubUpdatedAt).toLocaleString(), repro: Boolean(i.analysis?.missingRepro), dupes: i.duplicateSources?.length ?? 0, reason: i.analysis?.severityReason ?? "Raw GitHub issue synced. AI analysis is unavailable or pending.", dup: (i.duplicateSources ?? []).map((d) => [d.targetIssue.number, d.targetIssue.title, d.score.toFixed(2)]) }; }); }
function Severity({ sev }: { sev: string }) { const cls = sev === "Critical" ? "bg-red-700" : sev === "High" ? "bg-orange-600" : sev === "Raw" ? "bg-slate-600" : sev === "Low" ? "bg-emerald-700" : "bg-yellow-600"; return <Badge className={cls}><AlertTriangle className="mr-1 h-3 w-3" />{sev}</Badge>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><h3 className="mb-2 font-semibold text-white">{title}</h3><div className="text-sm leading-6 text-slate-300">{children}</div></section>; }
