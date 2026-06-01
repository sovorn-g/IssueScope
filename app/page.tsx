"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  Radar,
  RefreshCcw,
  Search,
  Trash2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type UiIssue = {
  id?: string;
  sev: string;
  title: string;
  no: number;
  labels: string[];
  comments: number;
  updated: string;
  repro: boolean;
  dupes: number;
  reason: string;
  dup: [number, string, string][];
};
type RepoView = { name: string; badge: string; synced: string };
type RecentRepository = { id: string; fullName: string; lastSyncedAt: string | null; _count: { issues: number } };

const sampleIssues: UiIssue[] = [
  { sev: "Critical", title: "Install fails on Node 22 with native binding error", no: 1287, labels: ["bug", "install"], comments: 19, updated: "18m ago", repro: false, dupes: 4, reason: "Blocks fresh installs and has multiple confirmations across Linux and macOS.", dup: [[1268, "Native binding cannot load after 2.4.0", ".91"], [1241, "Postinstall exits 1 on CI", ".84"]] },
  { sev: "High", title: "Hydration mismatch after upgrading to React 19", no: 1279, labels: ["bug", "regression"], comments: 8, updated: "2h ago", repro: true, dupes: 3, reason: "Affects upgrade path and includes production impact but no minimal reproduction.", dup: [[1252, "Client/server mismatch on nested route", ".87"], [1220, "React 19 warning on first render", ".81"]] },
  { sev: "High", title: "CLI reports success but leaves config file empty", no: 1273, labels: ["cli", "data-loss"], comments: 5, updated: "4h ago", repro: true, dupes: 1, reason: "Potential data-loss workflow with incomplete environment details.", dup: [[1194, "Init command overwrites config", ".79"]] },
  { sev: "Medium", title: "Windows path separator breaks generated routes", no: 1266, labels: ["windows"], comments: 4, updated: "1d ago", repro: false, dupes: 0, reason: "Platform-specific breakage with clear reproduction steps.", dup: [] },
];
const steps = ["Connecting to GitHub", "Fetching repository metadata", "Fetching latest open issues", "Filtering pull requests", "Persisting issues", "Preparing dashboard"];

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<"landing" | "sync" | "dashboard">("landing");
  const [showPat, setShowPat] = useState(false);
  const [repoUrl, setRepoUrl] = useState("https://github.com/vercel/next.js");
  const [pat, setPat] = useState("");
  const [issues, setIssues] = useState<UiIssue[]>(sampleIssues);
  const [selected, setSelected] = useState<UiIssue>(sampleIssues[0]);
  const [repo, setRepo] = useState<RepoView>({ name: "vercel/next.js", badge: "Sample data", synced: "Last synced 2h ago · AI analysis complete" });
  const [activeStep, setActiveStep] = useState(5);
  const [status, setStatus] = useState("120 / 200 issues processed");
  const [error, setError] = useState("");
  const [recentRepos, setRecentRepos] = useState<RecentRepository[]>([]);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecentRepository | null>(null);

  useEffect(() => {
    void loadRecentRepos();
  }, []);

  async function loadRecentRepos() {
    const data = await fetch("/api/repositories").then((r) => r.json()).catch(() => ({ repositories: [] }));
    setRecentRepos(data.repositories ?? []);
    setReposLoaded(true);
  }

  async function openRepository(repositoryId: string) {
    setError("");
    router.push(`/dashboard/${repositoryId}`);
  }

  async function deleteRepository(repositoryId: string) {
    setError("");
    const res = await fetch("/api/repositories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryId }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not delete repository.");
      return;
    }
    setDeleteTarget(null);
    await loadRecentRepos();
  }

  function openSample() {
    setIssues(sampleIssues);
    setSelected(sampleIssues[0]);
    setRepo({ name: "vercel/next.js", badge: "Sample data", synced: "Last synced 2h ago · AI analysis complete" });
    setPhase("dashboard");
  }

  const summary = useMemo(() => [
    ["Critical", String(issues.filter((i) => i.sev === "Critical").length), "Likely breaking installs, builds, security, or core workflows."],
    ["High priority", String(issues.filter((i) => i.sev === "High").length), "Needs maintainer review before routine backlog work."],
    ["Missing repro", String(issues.filter((i) => i.repro).length), "Reports missing steps, environment, or a minimal reproduction."],
    ["Likely duplicates", String(issues.reduce((n, i) => n + i.dupes, 0)), "Semantic matches across recent open issues."],
  ], [issues]);

  async function startLiveSync() {
    if (!pat.trim()) {
      setError("A GitHub token is required for live sync so IssueScope can reliably read issues.");
      return;
    }
    setError("");
    setPhase("sync");
    setActiveStep(0);
    setStatus("Starting sync…");
    try {
      const validation = await fetch("/api/validate-github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, pat }) });
      const validationData = await validation.json();
      if (!validation.ok) throw new Error(validationData.error ?? "GitHub URL or token is invalid");
      setStatus(`GitHub URL and token are valid for ${validationData.repository.fullName}. Syncing issues…`);
      setActiveStep(1);
      const tick = setInterval(() => setActiveStep((s) => Math.min(s + 1, 4)), 700);
      const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, pat }) });
      const data = await res.json();
      clearInterval(tick);
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setActiveStep(5);
      setStatus(`${data.syncRun.issuesStored} / ${data.syncRun.issuesFetched} issues stored`);
      await loadRecentRepos();
      router.push(`/dashboard/${data.repositoryId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setStatus("Sync failed");
    }
  }

  if (phase === "landing") {
    if (!reposLoaded) return <LoadingDeck />;
    return recentRepos.length > 0 ? (
      <ConnectedRepositories
        recentRepos={recentRepos}
        repoUrl={repoUrl}
        pat={pat}
        showPat={showPat}
        error={error}
        showAddRepo={showAddRepo}
        onRepoUrlChange={setRepoUrl}
        onPatChange={setPat}
        onTogglePat={() => setShowPat((v) => !v)}
        onOpenRepository={openRepository}
        onStartLiveSync={startLiveSync}
        onOpenSample={openSample}
        onOpenAddRepo={() => setShowAddRepo(true)}
        onCloseAddRepo={() => setShowAddRepo(false)}
        deleteTarget={deleteTarget}
        onRequestDelete={setDeleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={deleteRepository}
      />
    ) : (
      <FirstRunLanding
        repoUrl={repoUrl}
        pat={pat}
        showPat={showPat}
        error={error}
        onRepoUrlChange={setRepoUrl}
        onPatChange={setPat}
        onTogglePat={() => setShowPat((v) => !v)}
        onStartLiveSync={startLiveSync}
        onOpenSample={openSample}
      />
    );
  }

  if (phase === "sync") return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_20%,#ccfbf1,transparent_28%),linear-gradient(135deg,#fff7ed,#f8fafc)] p-6"><Card className="w-full max-w-2xl border-slate-900/10 bg-[#fffaf0]/95 shadow-radar"><CardContent className="p-8"><Badge className="mb-4 bg-slate-900">Sync run</Badge><h1 className="font-display text-4xl font-bold">Preparing maintainer radar</h1><p className="mt-3 text-muted-foreground">Large repositories can take a minute or two. Your token is used only for this request.</p><div className="mt-8 space-y-3">{steps.map((s, i) => <div key={s} className="flex items-center gap-3 rounded-xl border bg-white/55 p-3"><span className={`grid h-7 w-7 place-items-center rounded-full ${i < activeStep ? "bg-teal-700 text-white" : i === activeStep ? "bg-amber-500 text-white" : "bg-slate-200"}`}>{i < activeStep ? <Check className="h-4 w-4" /> : i === activeStep ? <Loader2 className="h-4 w-4 animate-spin" /> : ""}</span>{s}</div>)}</div><div className="mt-7 flex items-center justify-between gap-4"><span className="font-semibold">{error || status}</span>{error && <Button onClick={() => setPhase("landing")}>Retry</Button>}</div></CardContent></Card></main>;

  return <main className="mx-auto min-h-screen max-w-[1500px] p-4 md:p-7"><header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-[#fffaf0]/75 p-5 shadow-sm backdrop-blur"><div><Badge variant="outline"><GitBranch className="mr-1 h-3 w-3" /> {repo.badge}</Badge><h1 className="mt-2 font-display text-4xl font-bold">{repo.name}</h1><p className="text-muted-foreground">{repo.synced}</p></div><div className="flex gap-2"><Button variant="outline" onClick={startLiveSync}><RefreshCcw className="h-4 w-4" /> Sync Now</Button><Button onClick={() => setPhase("landing")}>Repositories</Button></div></header><section className="grid gap-4 md:grid-cols-4">{summary.map(([name,count,copy]) => <Card key={name} className="bg-white/65"><CardContent className="p-5"><div className="text-sm font-semibold text-muted-foreground">{name}</div><div className="font-display text-5xl font-bold">{count}</div><p className="mt-2 text-sm text-muted-foreground">{copy}</p></CardContent></Card>)}</section><section className="mt-5 grid gap-5 lg:grid-cols-[1fr_470px]"><Card className="bg-[#fffaf0]/80"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-3xl font-bold">Triage Queue</h2><div className="relative hidden sm:block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search issues" /></div></div><div className="space-y-3">{issues.map(issue => <button key={issue.no} onClick={() => setSelected(issue)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected.no === issue.no ? "bg-slate-950 text-white" : "bg-white/70"}`}><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{issue.title} <span className="opacity-65">#{issue.no}</span></h3><Severity sev={issue.sev} /></div><p className="mt-2 text-sm opacity-75">{issue.labels.join(" · ") || "no labels"} · {issue.comments} comments · updated {issue.updated}</p><p className="mt-3 text-sm opacity-80">Reason: {issue.reason}</p></button>)}</div></CardContent></Card><aside className="lg:sticky lg:top-7 lg:h-[calc(100vh-3.5rem)]"><Card className="h-full overflow-hidden bg-slate-950 text-slate-50 shadow-radar"><CardContent className="flex h-full flex-col gap-5 overflow-auto p-6"><Severity sev={selected.sev} /><h2 className="font-display text-3xl font-bold">{selected.title}</h2><p className="text-slate-300">#{selected.no} · updated {selected.updated}</p><Panel title={`Why this is ${selected.sev.toLowerCase()} priority`}>{selected.reason}</Panel><Panel title="Likely duplicates"><div className="space-y-2">{selected.dup.length ? selected.dup.map(d => <div key={d[0]} className="rounded-xl bg-white/10 p-3">#{d[0]} {d[1]} — <b>{d[2]}</b> similarity</div>) : "Duplicate detection starts in Phase 3."}</div></Panel><Panel title="Draft maintainer reply"><p className="mb-2 text-xs text-slate-400">AI-generated draft. Review before posting to GitHub.</p><Textarea className="border-white/15 bg-white/10 text-slate-50" defaultValue={`Thanks for the report. This issue has been synced into IssueScope. ${selected.reason}`} /><Button className="mt-3 bg-teal-600 hover:bg-teal-500"><Copy className="h-4 w-4" /> Copy draft</Button></Panel></CardContent></Card></aside></section></main>;
}

function LoadingDeck() {
  return <main className="grid min-h-screen place-items-center bg-[#f8f3e8] p-6"><div className="rounded-full border bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading repository deck</div></main>;
}

function FirstRunLanding(props: ImportFormProps) {
  return <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#99f6e4,transparent_26%),radial-gradient(circle_at_90%_0%,#fed7aa,transparent_28%),linear-gradient(135deg,#fff7ed,#f8fafc_58%,#ecfeff)] px-6 py-10"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]"><section><Badge className="mb-5 bg-teal-800 text-amber-50"><Radar className="mr-1 h-3 w-3" /> Maintainer command center</Badge><h1 className="font-display text-6xl font-black leading-[.92] tracking-tight text-slate-950 md:text-8xl">AI issue triage for open-source maintainers.</h1><p className="mt-7 max-w-2xl text-xl leading-8 text-slate-700">Paste a public GitHub repo, sync latest issues, and get a ranked triage queue with severity, semantic duplicates, missing repro flags, and draft maintainer replies.</p><div className="mt-10 grid gap-3 sm:grid-cols-3">{["Real issue sync", "PAT never stored", "Postgres persistence"].map((x) => <div key={x} className="rounded-2xl border bg-white/45 p-4 shadow-sm backdrop-blur"><Sparkles className="mb-3 h-5 w-5 text-teal-700" />{x}</div>)}</div></section><ImportCard {...props} /></div><SampleStrip onOpenSample={props.onOpenSample} /></main>;
}

function ConnectedRepositories(props: ImportFormProps & { recentRepos: RecentRepository[]; showAddRepo: boolean; deleteTarget: RecentRepository | null; onOpenRepository: (id: string) => void; onOpenAddRepo: () => void; onCloseAddRepo: () => void; onRequestDelete: (repo: RecentRepository) => void; onCancelDelete: () => void; onConfirmDelete: (id: string) => void }) {
  return <main className="min-h-screen bg-[linear-gradient(135deg,#0f172a,#13231f_42%,#f97316_180%)] px-6 py-8 text-slate-50"><div className="mx-auto max-w-7xl"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6"><div><Badge className="mb-4 bg-amber-400 text-slate-950"><Database className="mr-1 h-3 w-3" /> Connected repositories</Badge><h1 className="font-display text-5xl font-black tracking-tight md:text-7xl">Maintainer radar</h1><p className="mt-3 max-w-2xl text-slate-300">Open a saved dashboard from Postgres, or add another public repository when you need a fresh sync.</p></div><div className="flex flex-wrap items-center gap-3"><div className="inline-flex h-12 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 text-sm font-semibold backdrop-blur"><span className="text-xl font-black leading-none">{props.recentRepos.length}</span><span className="text-slate-300">connected repos</span></div><Button size="lg" className="h-12 bg-amber-400 px-5 text-slate-950 hover:bg-amber-300" onClick={props.onOpenAddRepo}>Add new repo</Button></div></header><section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.recentRepos.map((repo, index) => <div key={repo.id} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#fffaf0] p-6 text-left text-slate-950 shadow-2xl transition duration-300 hover:-translate-y-1 hover:rotate-[.35deg]"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-300/50 blur-2xl transition group-hover:scale-150" /><button className="absolute right-4 top-4 z-10 rounded-full border border-red-200 bg-red-50 p-2 text-red-700 shadow-sm transition hover:bg-red-100" aria-label={`Delete ${repo.fullName}`} onClick={(event) => { event.stopPropagation(); props.onRequestDelete(repo); }}><Trash2 className="h-4 w-4" /></button><button onClick={() => props.onOpenRepository(repo.id)} className="relative block w-full text-left"><Badge variant="outline" className="relative bg-white/70">Repo {String(index + 1).padStart(2, "0")}</Badge><h2 className="relative mt-8 break-words pr-9 font-display text-3xl font-black">{repo.fullName}</h2><p className="relative mt-3 text-sm text-slate-600">{repo._count.issues} stored open issues</p><div className="relative mt-8 flex items-center justify-between"><span className="text-xs text-slate-500">Last synced<br />{repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : "never"}</span><Badge className="bg-slate-950">Open dashboard</Badge></div></button></div>)}</section></div>{props.deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-repo-title"><Card className="w-full max-w-md bg-[#fffaf0] text-slate-950 shadow-radar"><CardContent className="p-6"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700"><Trash2 className="h-6 w-6" /></div><h2 id="delete-repo-title" className="font-display text-3xl font-bold">Delete connected repo?</h2><p className="mt-3 text-sm leading-6 text-slate-600">This will remove <b>{props.deleteTarget.fullName}</b> and its synced issues, analyses, embeddings, comments, and duplicate candidates from your local database. You can reconnect it later with a GitHub token.</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={props.onCancelDelete}>Cancel</Button><Button className="bg-red-700 hover:bg-red-600" onClick={() => props.onConfirmDelete(props.deleteTarget!.id)}><Trash2 className="h-4 w-4" /> Delete repo</Button></div></CardContent></Card></div>}{props.showAddRepo && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-lg"><div className="mb-3 flex justify-end"><Button variant="secondary" onClick={props.onCloseAddRepo}>Close</Button></div><ImportCard dark {...props} /></div></div>}</main>;
}

type ImportFormProps = {
  repoUrl: string;
  pat: string;
  showPat: boolean;
  error: string;
  onRepoUrlChange: (value: string) => void;
  onPatChange: (value: string) => void;
  onTogglePat: () => void;
  onStartLiveSync: () => void;
  onOpenSample: () => void;
};

function ImportCard({ repoUrl, pat, showPat, error, onRepoUrlChange, onPatChange, onTogglePat, onStartLiveSync, dark }: ImportFormProps & { dark?: boolean }) {
  return <Card className={`border-slate-900/10 shadow-radar ${dark ? "bg-[#fffaf0] text-slate-950" : "bg-[#fffaf0]/90 backdrop-blur"}`}><CardContent className="p-7"><h2 className="font-display text-3xl font-bold">Analyze a GitHub repo</h2><p className="mt-2 text-sm text-slate-600">Validate the URL and token first, then sync up to 200 open issues.</p><div className="mt-6 space-y-5"><label className="block text-sm font-semibold">Repo URL<Input className="mt-2" value={repoUrl} onChange={(e) => onRepoUrlChange(e.target.value)} /></label><label className="block text-sm font-semibold">GitHub PAT<div className="mt-2 flex gap-2"><Input type={showPat ? "text" : "password"} value={pat} onChange={(e) => onPatChange(e.target.value)} placeholder="github_pat_••••••••••" /><Button variant="outline" size="icon" aria-label="Toggle PAT visibility" onClick={onTogglePat}>{showPat ? <EyeOff /> : <Eye />}</Button></div><a className="mt-2 inline-block text-xs font-medium text-teal-800 underline underline-offset-4" href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">Create a GitHub personal access token</a></label>{error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<div className="rounded-2xl border border-teal-900/20 bg-teal-50 p-4 text-sm text-teal-950"><ShieldCheck className="mb-2 h-5 w-5" />Required for live sync. Used only for GitHub API requests and never stored on our server.</div><Button className="w-full" size="lg" onClick={onStartLiveSync}>Start analysis</Button></div></CardContent></Card>;
}

function SampleStrip({ onOpenSample, dark }: { onOpenSample: () => void; dark?: boolean }) {
  return <section className={`mx-auto mt-16 max-w-7xl rounded-[2rem] border p-6 ${dark ? "border-white/10 bg-white/10 text-slate-50" : "border-slate-900/10 bg-white/55 text-slate-950"}`}><div className="flex flex-wrap items-center justify-between gap-4"><div><Badge variant="outline" className={dark ? "border-white/20 text-slate-100" : "bg-white/70"}>Sample dashboard</Badge><h2 className="mt-3 font-display text-3xl font-bold">Just browsing? Open the cached maintainer demo.</h2><p className={dark ? "mt-1 text-slate-300" : "mt-1 text-slate-600"}>The sample stays out of the primary path but remains available for quick portfolio review.</p></div><Button variant={dark ? "secondary" : "default"} size="lg" onClick={onOpenSample}>Open sample repo</Button></div></section>;
}

function Severity({ sev }: { sev: string }) { const cls = sev === "Critical" ? "bg-red-700" : sev === "High" ? "bg-orange-600" : sev === "Raw" ? "bg-slate-600" : "bg-yellow-600"; return <Badge className={cls}><AlertTriangle className="mr-1 h-3 w-3" />{sev}</Badge>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><h3 className="mb-2 font-semibold text-white">{title}</h3><div className="text-sm leading-6 text-slate-300">{children}</div></section>; }
