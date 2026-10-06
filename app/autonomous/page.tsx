"use client";

import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import { Callout, Stat } from "../../components/ui";
import { SCOPE_TARGETS } from "../../lib/autonomous/scope";
import type { AutonomousReport, RepoHypothesis } from "../../lib/autonomous/report";
import type { Manifest } from "../../lib/autonomous/ingest";
import { useWorkspace } from "../../lib/workspace/store";

const signalBadge: Record<string, string> = {
  "recently-touched": "badge-blue",
  "possibly-fixed": "badge-yellow",
  "attack-surface": "badge-green",
  "in-scope-code": "badge-green",
  context: "badge-gray",
};

export default function AutonomousPage() {
  const { state } = useWorkspace();
  const [pinned, setPinned] = useState<string | null>(null); // null = let the product choose
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<AutonomousReport | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [markdown, setMarkdown] = useState("");

  const records = state.github?.records ?? [];

  async function start() {
    setRunning(true); setError(""); setReport(null); setManifest(null); setMarkdown("");
    try {
      const res = await fetch("/api/autonomous/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRecords: records, analyses: state.analyses, repository: pinned ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Run failed (${res.status})`);
      setReport(data.report as AutonomousReport);
      setManifest(data.manifest as Manifest);
      setMarkdown(data.markdown as string);
    } catch (e) { setError(e instanceof Error ? e.message : "Run failed"); }
    finally { setRunning(false); }
  }

  const f = report?.capabilityProof.finding;

  return <div>
    <PageHeader
      eyebrow="Autonomous"
      title="Autonomous hunt"
      description="The product selects an in-scope target on its own, clones it into local dev (commit-pinned, scope-filtered), proves its discover→prove→replay pipeline, and produces a cross-referenced research dossier. Human review is required before any submission."
      aside={<span className="badge badge-green self-start md:self-auto">Local only · human review required</span>}
    />

    <div className="mt-6 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setPinned(null)} aria-pressed={pinned === null}
        className={`btn btn-sm ${pinned === null ? "btn-primary" : "btn-ghost"}`}>Let the product choose</button>
      {SCOPE_TARGETS.map((t) => (
        <button key={t.repository} type="button" onClick={() => setPinned(t.repository)} aria-pressed={pinned === t.repository}
          className={`btn btn-sm ${pinned === t.repository ? "btn-primary" : "btn-ghost"}`}>{t.repository.replace("circlefin/", "")}</button>
      ))}
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={start} disabled={running} className="btn btn-primary px-6">
        {running ? "Selecting, cloning & hunting…" : pinned ? `Hunt ${pinned.replace("circlefin/", "")}` : "Start autonomous hunt"}
      </button>
      <span className="text-xs text-gray-500">One click: select → clone into local dev → prove pipeline → run real Rust harness against the code → verdict. Imported: {records.length} GitHub records · {state.analyses.length} analyses.</span>
    </div>

    {error && <div className="mt-4"><Callout tone="danger" role="alert">{error}</Callout></div>}

    {report && f && <div className="mt-8 space-y-6">
      <div className={`rounded-2xl border p-5 sm:p-6 ${report.verdict.submit ? "border-yellow-500/30 bg-yellow-500/[.06]" : "border-white/10 bg-white/[.03]"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`badge ${report.verdict.submit ? "badge-yellow" : "badge-gray"}`}>{report.verdict.submit ? "REVIEW FOR SUBMISSION" : "DO NOT SUBMIT"}</span>
          <p className="font-semibold">Verdict</p>
        </div>
        <p className="mt-2 text-sm text-gray-200">{report.verdict.label}</p>
        <ul className="mt-2 space-y-1 text-xs text-gray-400">{report.verdict.reasons.map((x) => <li key={x}>• {x}</li>)}</ul>
      </div>

      {report.draftReport && <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/[.06] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Drafted submission, a harness returned BROKEN</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(report.draftReport ?? "")} className="btn btn-sm btn-ghost">Copy draft</button>
        </div>
        <p className="muted mt-1 text-xs">Review every checklist box before sending. This is a draft, not a confirmed finding.</p>
        <pre className="mt-3 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-5 text-gray-200">{report.draftReport}</pre>
      </div>}

      {report.executed.length > 0 && <div className="card card-p">
        <p className="kicker">Real Rust execution, ran against the cloned code</p>
        <ul className="mt-3 space-y-3">
          {report.executed.map((h) => (
            <li key={h.property}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${h.result === "HELD" ? "badge-green" : h.result === "BROKEN" ? "badge-red" : "badge-yellow"}`}>{h.result}</span>
                <span className="text-sm text-gray-300"><span className="font-mono text-xs">{h.property}</span> on <span className="font-mono text-xs">{h.crate}</span> at commit <span className="font-mono text-xs">{h.commit.slice(0, 12)}</span></span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="badge badge-gray">{h.iters.toLocaleString()} sequences</span>
                <span className="badge badge-gray">{h.quorumsVerified.toLocaleString()} checks verified</span>
                <span className="badge badge-gray">{h.violations} violations</span>
                <span className="badge badge-gray">{h.seconds}s</span>
              </div>
              {h.result === "HELD" && <p className="muted mt-2 text-xs">Honest outcome: could not break this property on real code, evidence it is sound for the cases searched, not a vulnerability.</p>}
              {h.counterexample && <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11px] text-red-300">{h.counterexample}</pre>}
            </li>
          ))}
        </ul>
      </div>}

      {report.generation.length > 0 && <div className="card card-p">
        <p className="kicker">Self-generated harness plan, what the product chose to run, and why</p>
        <ul className="mt-3 space-y-2.5">
          {report.generation.map((g) => (
            <li key={g.leadId} className="well p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${g.status === "generated-and-run" ? "badge-green" : "badge-gray"}`}>{g.status === "generated-and-run" ? "generated + run" : "pending (no template)"}</span>
                {g.result && <span className={`badge ${g.result === "HELD" ? "badge-green" : g.result === "BROKEN" ? "badge-red" : "badge-yellow"}`}>{g.result}</span>}
                <span className="text-sm text-gray-200">{g.leadTitle}</span>
              </div>
              {g.property && <p className="muted mt-1 font-mono text-[11px]">{g.property} · {g.crate}</p>}
              <p className="muted mt-1 text-xs">{g.note}</p>
              {g.triggerPRs.map((pr, i) => <p key={i} className="mt-1 text-[11px] text-gray-500">flagged by {pr.url ? <a href={pr.url} target="_blank" rel="noreferrer" className="underline">{pr.label}</a> : pr.label}</p>)}
            </li>
          ))}
        </ul>
      </div>}

      <Callout tone="warn"><b>Research dossier.</b> The ranked items below are prioritized leads, not confirmed vulnerabilities. A lead becomes submittable only after a harness reproduces it on the real code, it is minimized, impact-measured, and reviewed by you, which is what the verdict above tracks.</Callout>

      {report.intelligence && <div className="card card-p">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="kicker">Intelligence, reasoning advises, the gate decides</p>
          <span className={`badge ${report.intelligence.gate.verdict === "SUBMIT_RECOMMENDED" ? "badge-green" : report.intelligence.gate.verdict === "DISPROVED" ? "badge-red" : "badge-yellow"}`}>{report.intelligence.gate.verdict}</span>
        </div>
        <p className="muted mt-2 text-sm">{report.intelligence.gate.reason}</p>
        <p className="muted mt-1 text-xs">Analyst ({report.intelligence.intelligence.analyst}): {report.intelligence.intelligence.overallAssessment}</p>

        <p className="kicker mt-4 !text-xs">Evidence gate, AI cannot override</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(report.intelligence.gate.gates).map(([k, v]) => (
            <span key={k} className={`badge ${v === "PASS" ? "badge-green" : "badge-gray"} !text-[10px]`}>{v === "PASS" ? "✓" : "✗"} {k.replace(/_/g, " ")}</span>
          ))}
        </div>

        <p className="kicker mt-4 !text-xs">Reasoning branches</p>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {report.intelligence.intelligence.branches.map((b) => (
            <li key={b.name} className="well p-2.5">
              <p className="text-xs font-medium capitalize text-gray-200">{b.name.replace(/_/g, " ")}</p>
              <p className="muted mt-0.5 text-[11px] leading-4">{b.conclusion}</p>
            </li>
          ))}
        </ul>

        {report.intelligence.intelligence.contradictions.length > 0 && <>
          <p className="kicker mt-4 !text-xs">Contradictions preserved</p>
          <ul className="mt-2 space-y-2">
            {report.intelligence.intelligence.contradictions.map((c, i) => (
              <li key={i} className="well p-2.5 text-[11px] leading-4">
                <p className="text-gray-300"><b>A:</b> {c.a}</p>
                <p className="mt-0.5 text-gray-300"><b>B:</b> {c.b}</p>
                <p className="mt-1 text-gray-500">→ {c.resolution} <span className="text-gray-400">Resolving experiment: {c.resolvingExperiment}</span></p>
              </li>
            ))}
          </ul>
        </>}
      </div>}

      <section className="stat-grid">
        <Stat label="Selected target" value={<span className="text-base sm:text-lg">{report.target.repository.replace("circlefin/", "")}</span>} hint={report.selection ? "chosen autonomously" : "pinned"} />
        <Stat label="Cloned at commit" value={<span className="font-mono text-sm sm:text-base">{manifest?.commit.slice(0, 10) ?? "-"}</span>} hint={manifest ? `${manifest.inScopeFiles} in-scope files` : undefined} />
        <Stat label="Capability proof" value={f.status === "GREEN_SYNTHETIC" ? "GREEN" : f.status} hint={`${f.replays.filter((r) => r.hit).length}/${report.capabilityProof.replaysRun} replays`} />
        <Stat label="Leads" value={report.hypotheses.length} hint="ranked, untested" />
      </section>

      {report.selection && <div className="card card-p">
        <p className="kicker">Target selection (chosen autonomously)</p>
        <p className="muted mt-2 text-sm">Picked <b className="font-mono">{report.target.repository.replace("circlefin/", "")}</b> because: {report.selection.reasons.join("; ")}.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {report.selection.ranking.map((x) => (
            <span key={x.repository} className={`badge ${x.repository === report.target.repository ? "badge-green" : "badge-gray"}`}>{x.repository.replace("circlefin/", "")} · {x.score}</span>
          ))}
        </div>
      </div>}

      {manifest && <div className="card card-p">
        <p className="kicker">Local ingestion (cloned into local dev)</p>
        <p className="muted mt-2 text-sm">
          <span className="font-mono text-xs">{manifest.path}</span> · commit <span className="font-mono text-xs">{manifest.commit.slice(0, 12)}</span> ({manifest.branch})
        </p>
        <p className="muted mt-1 text-sm">{manifest.inScopeFiles} of {manifest.totalFiles} files in scope ({Math.round(manifest.inScopeBytes / 1024)} KB) · {Object.entries(manifest.languages).map(([k, v]) => `${k} ${v}%`).join(", ")}</p>
        {manifest.scopeNote && <p className="muted mt-1 text-xs">Scope boundary applied: {manifest.scopeNote}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {manifest.topDirs.slice(0, 8).map((d) => <span key={d.dir} className="badge badge-gray font-mono text-[10px]">{d.dir.replace("code/crates/", "")} · {d.files}</span>)}
        </div>
      </div>}

      <div className="card card-p">
        <p className="kicker">Capability proof, how the engine proves a finding</p>
        <p className="muted mt-2 text-sm">Run on a model the engine controls, to show the pipeline is real. The same pipeline validates a real lead once an executable harness exists in the cloned code.</p>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="well p-3"><span className="text-xs text-gray-500">Minimal reproduction (discovered without the answer)</span><p className="mt-1 font-mono text-xs">{f.minimalPath.join(" → ")}</p></div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-green">every step necessary: {f.causalControls.every((c) => c.necessary) ? "yes" : "no"}</span>
            <span className="badge badge-green">replays: {f.replays.filter((r) => r.hit).length}/{report.capabilityProof.replaysRun}</span>
            <span className="badge badge-blue">examined {f.stats.examined.toLocaleString()}</span>
          </div>
          {f.impact && <p className="muted text-xs">Impact: {f.impact.summary}</p>}
        </div>
      </div>

      <div>
        <p className="kicker mb-3">Ranked leads, untested against the real code</p>
        <ol className="space-y-3">
          {report.hypotheses.map((h: RepoHypothesis, i) => (
            <li key={h.id} className="card card-p">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{i + 1}. {h.title}</h3>
                <span className="flex shrink-0 gap-1.5"><span className="badge badge-gray">{h.status.toLowerCase()}</span><span className="badge badge-gray">conf {h.confidence}</span></span>
              </div>
              <p className="muted mt-1 text-xs">{h.vulnClass}</p>
              <p className="mt-2 text-sm text-gray-300">{h.rationale}</p>
              {h.crossRefs.length > 0 && <ul className="mt-3 space-y-1.5">
                {h.crossRefs.map((c, j) => (
                  <li key={j} className="flex flex-wrap items-start gap-2 text-xs">
                    <span className={`badge ${signalBadge[c.signal] ?? "badge-gray"}`}>{c.signal}</span>
                    <span className="min-w-0 text-gray-300">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.label}</a> : <span className="font-mono text-[11px]">{c.label}</span>}, <span className="text-gray-500">{c.detail}</span></span>
                  </li>
                ))}
              </ul>}
              <p className="mt-3 text-xs text-gray-500">To confirm: {h.toConfirm.map((s, k) => <span key={k}>{k ? " → " : ""}<span className="text-gray-400">{s}</span></span>)}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="card card-p">
        <p className="kicker">Limitations</p>
        <ul className="muted mt-2 space-y-1.5 text-sm">{report.limitations.map((l) => <li key={l}>• {l}</li>)}</ul>
      </div>

      <details className="card card-p">
        <summary className="cursor-pointer text-sm font-medium">Full dossier (markdown)</summary>
        <button type="button" onClick={() => navigator.clipboard?.writeText(markdown)} className="btn btn-sm btn-ghost mt-3">Copy markdown</button>
        <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-5 text-gray-300">{markdown}</pre>
      </details>
    </div>}
  </div>;
}
