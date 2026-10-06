"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { Callout, Stat } from "../../components/ui";
import { archSetuUrl, importArchSetuAnalysis, repoFromLink } from "../../lib/external-analysis/archsetu";
import type { ExternalAnalysis } from "../../lib/external-analysis/types";
import { MAX_REPOS, parseRepo } from "../../lib/github/repos";
import { useWorkspace } from "../../lib/workspace/store";

const UNKNOWN = "Unknown repository";

interface Slot { link: string; report: string; paste: boolean }
type Fetched =
  | { state: "loading"; link: string }
  | { state: "ok"; link: string; analysis: ExternalAnalysis }
  | { state: "error"; link: string; error: string };
interface LinkResult { link: string; ok: boolean; analysis?: ExternalAnalysis; error?: string }

const blank = (): Slot => ({ link: "", report: "", paste: false });
const pad = (slots: Slot[]) => [...slots, ...Array.from({ length: Math.max(0, MAX_REPOS - slots.length) }, blank)].slice(0, MAX_REPOS);
const filled = (s: Slot) => Boolean(s.link.trim() || s.report.trim());

async function fetchLinks(links: string[]): Promise<LinkResult[]> {
  const res = await fetch("/api/analysis/archsetu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fetch failed (${res.status})`);
  return data.results as LinkResult[];
}

export default function ExternalAnalysisPage() {
  const { state, ready, setAnalyses } = useWorkspace();
  const results = state.analyses;

  // Start from saved imports, else the program's repositories, else empty.
  const initialSlots = useMemo<Slot[]>(() => {
    if (results.length) return pad(results.map((r) => ({ link: r.sourceUrl, report: r.origin === "pasted" ? r.reportText ?? "" : "", paste: r.origin === "pasted" })));
    const programRepos = Array.from(new Set((state.program?.repositories ?? []).map(parseRepo).filter((r): r is string => Boolean(r))));
    return pad(programRepos.map((r) => ({ link: archSetuUrl(r), report: "", paste: false })));
  }, [results, state.program]);
  const [edited, setEdited] = useState<Slot[] | null>(null);
  const slots = edited ?? initialSlots;

  const [fetched, setFetched] = useState<Record<number, Fetched>>({});
  // A slot's read result for its current link. Saved imports that were read from the
  // link count as already read. Older saves have no `origin` (they came from pasted
  // text, e.g. the old built-in sample) and must be re-read, not trusted.
  const readFor = (i: number, link: string): Fetched | undefined => {
    const l = link.trim();
    const f = fetched[i];
    if (f && f.link === l) return f;
    const saved = results.find((r) => r.origin === "link" && r.sourceUrl === l);
    return saved ? { state: "ok", link: l, analysis: saved } : undefined;
  };
  // Read every slot's link by itself once the workspace has loaded. A saved import that
  // was not read from its link (stale pasted data) is replaced with the fresh read.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const todo = initialSlots
      .map((s, i) => ({ i, link: s.link.trim() }))
      .filter(({ i, link }) => link && repoFromLink(link) && !readFor(i, link) && !attempted.current.has(`${i}|${link}`));
    if (!todo.length) return;
    todo.forEach(({ i, link }) => attempted.current.add(`${i}|${link}`));
    setFetched((f) => ({ ...f, ...Object.fromEntries(todo.map(({ i, link }) => [i, { state: "loading", link } as Fetched])) }));
    fetchLinks(todo.map((t) => t.link))
      .then((res) => {
        setFetched((f) => {
          const n = { ...f };
          todo.forEach(({ i, link }, k) => {
            if (n[i]?.link !== link) return;
            const r = res[k];
            n[i] = r.ok && r.analysis ? { state: "ok", link, analysis: r.analysis } : { state: "error", link, error: r.error ?? "Failed." };
          });
          return n;
        });
        const fresh = new Map(todo.map(({ link }, k) => [link, res[k]]).filter(([, r]) => (r as LinkResult).ok).map(([l, r]) => [l as string, (r as LinkResult).analysis!]));
        if (results.some((r) => r.origin !== "link" && fresh.has(r.sourceUrl))) {
          setAnalyses(results.map((r) => (r.origin !== "link" && fresh.has(r.sourceUrl) ? fresh.get(r.sourceUrl)! : r)));
        }
      })
      .catch((e) => setFetched((f) => ({ ...f, ...Object.fromEntries(todo.filter(({ i, link }) => f[i]?.link === link).map(({ i, link }) => [i, { state: "error", link, error: e instanceof Error ? e.message : "Failed." } as Fetched])) })));
    // Runs when the saved/prefilled slots change, not on every keystroke (typing is handled by blur/paste).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialSlots]);

  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  const setSlot = (i: number, patch: Partial<Slot>) => setEdited(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // Read one slot's link from ArchSetu.
  const fetchSlot = async (i: number, link: string) => {
    const l = link.trim();
    if (!l || !repoFromLink(l)) return;
    const current = readFor(i, l);
    if (current && current.state !== "error") return;
    setFetched((f) => ({ ...f, [i]: { state: "loading", link: l } }));
    try {
      const [r] = await fetchLinks([l]);
      setFetched((f) => (f[i]?.link !== l ? f : { ...f, [i]: r.ok && r.analysis ? { state: "ok", link: l, analysis: r.analysis } : { state: "error", link: l, error: r.error ?? "Failed." } }));
    } catch (e) {
      setFetched((f) => (f[i]?.link !== l ? f : { ...f, [i]: { state: "error", link: l, error: e instanceof Error ? e.message : "Failed." } }));
    }
  };

  const used = slots.filter(filled).length;

  const run = async () => {
    setError(""); setNotes([]);
    const active = slots.map((s, i) => ({ s, i })).filter(({ s }) => filled(s));
    if (!active.length) { setError("Paste at least one report link."); return; }

    // Fetch every link not already read, all in one parallel request.
    const missing = active.filter(({ s, i }) => s.link.trim() && repoFromLink(s.link) && readFor(i, s.link)?.state !== "ok");
    const latest: Record<number, Fetched | undefined> = Object.fromEntries(active.map(({ s, i }) => [i, readFor(i, s.link)]));
    if (missing.length) {
      setImporting(true);
      try {
        const res = await fetchLinks(missing.map(({ s }) => s.link.trim()));
        missing.forEach(({ s, i }, k) => {
          const r = res[k];
          latest[i] = r.ok && r.analysis ? { state: "ok", link: s.link.trim(), analysis: r.analysis } : { state: "error", link: s.link.trim(), error: r.error ?? "Failed." };
        });
        setFetched((f) => ({ ...f, ...Object.fromEntries(missing.map(({ i }) => [i, latest[i] as Fetched])) }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reach ArchSetu.");
        setImporting(false);
        return;
      }
      setImporting(false);
    }

    const out: ExternalAnalysis[] = [];
    const problems: string[] = [];
    for (const { s, i } of active) {
      const f = latest[i];
      let a: ExternalAnalysis | null = null;
      if (f?.state === "ok" && f.link === s.link.trim()) a = f.analysis;
      else if (s.report.trim()) {
        a = importArchSetuAnalysis(s.link.trim(), s.report);
        if (a.repository === UNKNOWN) { problems.push(`Repository ${i + 1}: couldn't tell which repository the pasted report is for.`); continue; }
      } else {
        problems.push(`Repository ${i + 1}: ${f?.state === "error" ? f.error : "not a report link, GitHub URL or owner/repo."}`);
        continue;
      }
      if (out.some((o) => o.repository.toLowerCase() === a!.repository.toLowerCase())) { problems.push(`Repository ${i + 1}: ${a.repository} is already in another slot.`); continue; }
      out.push(a);
    }
    if (!out.length) { setError(problems.join(" ") || "Nothing could be imported."); return; }
    setAnalyses(out);
    setNotes(problems);
  };

  const total = (k: "files" | "functions" | "deadCode" | "entryPoints") => {
    const vals = results.map((r) => r.summary[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0).toLocaleString() : "n/a";
  };
  const programRepoCount = state.program?.repositories.length ?? 0;

  return (
    <div>
      <PageHeader
        step="analysis"
        eyebrow="Repository analysis"
        title="Import repository analysis"
        description={`Paste ArchSetu report links for up to ${MAX_REPOS} repositories. Shakuni reads files, functions, dead code, entry points, health and languages from each report by itself. Treated as research context, never as a verdict.`}
      />

      <div className="mt-6">
        {state.program ? (
          <Callout>
            Program <span className="font-medium text-white">{state.program.name}</span>
            {programRepoCount
              ? <> lists {programRepoCount} {programRepoCount === 1 ? "repository" : "repositories"}{programRepoCount > MAX_REPOS ? ` (the first ${MAX_REPOS} are pre-filled)` : ""}.</>
              : <> lists no repositories. Add the ones you want to research below.</>}
          </Callout>
        ) : (
          <Callout tone="warn">No program imported yet, so scope cannot be cross-checked. <Link href="/bug-bounty" className="underline">Start with Program Intake</Link>.</Callout>
        )}
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="h2">Repositories</h2>
          <span className="text-xs text-gray-500">{used}/{MAX_REPOS} filled · empty slots are skipped</span>
        </div>
        <ol className="grid gap-4 lg:grid-cols-2">
          {slots.map((s, i) => {
            const f = readFor(i, s.link);
            const linkRepo = s.link.trim() ? repoFromLink(s.link) : null;
            const title = f?.state === "ok" ? f.analysis.repository : linkRepo ?? (s.link.trim() ? "not a recognised link" : "empty");
            return (
              <li key={i} className={`card card-p space-y-3 ${filled(s) ? "" : "opacity-80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-gray-400">{i + 1}</span>
                    <span className={`truncate font-mono text-xs ${s.link.trim() && !linkRepo ? "text-yellow-300" : filled(s) ? "text-gray-200" : "text-gray-600"}`}>{title}</span>
                  </span>
                  {filled(s) && <button type="button" onClick={() => { setSlot(i, blank()); setFetched((x) => { const n = { ...x }; delete n[i]; return n; }); }} className="text-xs text-gray-500 underline hover:text-white">Clear</button>}
                </div>
                <label className="label">Report link
                  <input
                    value={s.link}
                    onChange={(e) => setSlot(i, { link: e.target.value })}
                    onBlur={(e) => fetchSlot(i, e.target.value)}
                    onPaste={(e) => { const v = e.clipboardData.getData("text"); window.setTimeout(() => fetchSlot(i, v), 0); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchSlot(i, (e.target as HTMLInputElement).value); } }}
                    placeholder="https://www.archsetu.com/r/owner/repo, a GitHub URL, or owner/repo"
                    className="input mt-1.5 font-normal"
                  />
                </label>

                {f?.state === "loading" && <p className="text-xs text-gray-400" role="status">Reading the ArchSetu report…</p>}
                {f?.state === "error" && <p className="text-xs text-red-300" role="alert">{f.error}</p>}
                {f?.state === "ok" && <Preview a={f.analysis} />}

                {(s.paste || f?.state === "error") ? (
                  <label className="label">Report text {f?.state === "error" ? "(fallback)" : ""}
                    <textarea value={s.report} onChange={(e) => setSlot(i, { report: e.target.value, paste: true })} rows={3} placeholder="Paste the report summary: files, functions, dead code, entry points, health…" className="input mt-1.5 font-mono text-[13px] font-normal" />
                  </label>
                ) : (
                  f?.state !== "ok" && <button type="button" onClick={() => setSlot(i, { paste: true })} className="text-xs text-gray-500 underline hover:text-white">Paste report text instead</button>
                )}
              </li>
            );
          })}
        </ol>
        {error && <div className="mt-4"><Callout tone="danger" role="alert">{error}</Callout></div>}
        {notes.length > 0 && <div className="mt-4"><Callout tone="warn">Imported the rest. Skipped: {notes.join(" ")}</Callout></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={run} disabled={used === 0 || importing} className="btn btn-primary">
            {importing ? "Reading reports…" : `${results.length ? "Re-import" : "Import"} ${used} ${used === 1 ? "repository" : "repositories"}`}
          </button>
          {results.length > 0 && <button type="button" onClick={() => { setAnalyses([]); setEdited(null); setFetched({}); setNotes([]); }} className="btn btn-ghost">Remove imports</button>}
        </div>
      </section>

      {results.length > 0 && (
        <section className="mt-10 space-y-6" aria-live="polite" aria-label="Imported analyses">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <span className="badge badge-green">Saved to workspace</span>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{results.length} {results.length === 1 ? "repository" : "repositories"} analysed</h2>
            </div>
            <Link href="/github-intelligence" className="btn btn-primary shrink-0">Next: GitHub Evidence →</Link>
          </div>

          <div className="stat-grid-5">
            <Stat label="Files" value={total("files")} hint="all repositories" />
            <Stat label="Functions" value={total("functions")} />
            <Stat label="Dead code" value={total("deadCode")} />
            <Stat label="Entry points" value={total("entryPoints")} />
            <Stat label="Repositories" value={results.length} hint={`of ${MAX_REPOS}`} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-white/[.08] text-xs text-gray-500">
                <tr>{["Repository", "Health", "Files", "Functions", "Dead code", "Entry points", "Languages", "Source"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((r) => (
                  <tr key={r.repository}>
                    <th scope="row" className="px-4 py-3 font-mono text-xs font-normal text-gray-200">
                      {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{r.repository}</a> : r.repository}
                    </th>
                    <td className="px-4 py-3 tabular-nums text-gray-200">{r.summary.healthScore ?? "n/a"}</td>
                    {[r.summary.files, r.summary.functions, r.summary.deadCode, r.summary.entryPoints].map((v, i) => (
                      <td key={i} className="px-4 py-3 tabular-nums text-gray-300">{v?.toLocaleString() ?? "n/a"}</td>
                    ))}
                    <td className="px-4 py-3 text-xs text-gray-400">{topLanguages(r) || "n/a"}</td>
                    <td className="px-4 py-3"><span className={`badge ${r.origin === "link" ? "badge-blue" : "badge-gray"}`}>{r.origin === "link" ? "ArchSetu" : "pasted"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Panel title="Signals already available" items={results[0].signals} />
            <Panel title="How Shakuni will use them" items={results[0].reusableForResearch} />
          </div>
          <Panel title="Evidence boundaries" items={results[0].limitations} />
          <Callout tone="ok">Marked as upstream static-analysis evidence. Independent scope validation, invariant evaluation and a reproducible experiment are still required before anything is confirmed.</Callout>
        </section>
      )}
    </div>
  );
}

function topLanguages(a: ExternalAnalysis) {
  return Object.entries(a.summary.languages ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(", ");
}

function Preview({ a }: { a: ExternalAnalysis }) {
  const cells: [string, string | number | undefined][] = [
    ["Health", a.summary.healthScore],
    ["Files", a.summary.files?.toLocaleString()],
    ["Functions", a.summary.functions?.toLocaleString()],
    ["Dead code", a.summary.deadCode?.toLocaleString()],
    ["Entry points", a.summary.entryPoints?.toLocaleString()],
  ];
  return (
    <div className="well p-3">
      {a.details?.description && <p className="mb-2 text-xs leading-5 text-gray-300">{a.details.description}</p>}
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5">
        {cells.map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-[10px] text-gray-500">{k}</dt><dd className="truncate text-sm font-semibold tabular-nums">{v ?? "n/a"}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-gray-500">
        {[topLanguages(a), a.details?.stars != null ? `★ ${a.details.stars.toLocaleString()}` : "", a.details?.completedAt ? `analysed ${new Date(a.details.completedAt).toLocaleDateString()}` : ""].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card card-p">
      <h3 className="h2">{title}</h3>
      <ul className="mt-3 divide-y divide-white/5 text-sm text-gray-400">{items.map((item) => <li key={item} className="py-2.5 first:pt-0 last:pb-0">{item}</li>)}</ul>
    </div>
  );
}
