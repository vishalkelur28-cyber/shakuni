"use client";

import Link from "next/link";
import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import { Callout, Stat } from "../../components/ui";
import { buildArcReadinessReport, type CapabilityStatus } from "../../lib/arc/readiness";
import { useWorkspace } from "../../lib/workspace/store";

// Evidence flags stay false until real runtime evidence exists. Imported context never turns a check GREEN.
const report = buildArcReadinessReport({
  repositoryPinned: false,
  repositoryAnalyzed: false,
  runtimeVerified: false,
  consensusRuntimeVerified: false,
  signerRuntimeVerified: false,
  executionRuntimeVerified: false,
  reproductionHarnessVerified: false,
  duplicateIntelligenceVerified: false,
  humanApprovalConfigured: true,
});

const badge: Record<CapabilityStatus, string> = { GREEN: "badge-green", YELLOW: "badge-yellow", RED: "badge-red" };
const bar: Record<CapabilityStatus, string> = { GREEN: "bg-green-400", YELLOW: "bg-yellow-400", RED: "bg-red-400" };
type Filter = "ALL" | CapabilityStatus;

export default function ArcReadinessPage() {
  const { state } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("ALL");

  const count = (s: CapabilityStatus) => report.checks.filter((c) => c.status === s).length;
  const total = report.checks.length;
  const shown = filter === "ALL" ? report.checks : report.checks.filter((c) => c.status === filter);

  const inputs = [
    { label: "Program intake", value: state.program ? `${state.program.name} · ${state.program.assets.length} assets` : null, href: "/bug-bounty" },
    { label: "Repository analysis", value: state.analyses.length ? `${state.analyses.map((a) => a.repository).join(", ")} (static analysis)` : null, href: "/external-analysis" },
    { label: "GitHub evidence", value: state.github ? `${state.github.repos.join(", ")} · ${state.github.records.length} records` : null, href: "/github-intelligence" },
  ];

  return (
    <div>
      <PageHeader
        step="readiness"
        eyebrow="Readiness gate"
        title="Arc research readiness"
        description="GREEN means a capability has verified evidence. YELLOW means the engine exists but campaign evidence has not been produced. RED means a safety or control blocker."
      />

      <div className="stat-grid mt-8">
        <Stat label="Overall" value={<span className={report.status === "GREEN" ? "text-green-300" : report.status === "YELLOW" ? "text-yellow-300" : "text-red-300"}>{report.status}</span>} />
        <Stat label="Hard blockers" value={report.blockers.length} />
        <Stat label="Evidence gaps" value={count("YELLOW")} />
        <Stat label="Verified" value={`${count("GREEN")}/${total}`} />
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${count("GREEN")} green, ${count("YELLOW")} yellow, ${count("RED")} red of ${total} checks`}>
        {(["GREEN", "YELLOW", "RED"] as const).map((s) => <div key={s} className={bar[s]} style={{ width: `${(count(s) / total) * 100}%` }} />)}
      </div>

      <section className="mt-8">
        <h2 className="h2">Workspace inputs</h2>
        <p className="mt-0.5 text-sm text-gray-500">Imported context informs research. It does not turn any check GREEN by itself.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {inputs.map((i) => (
            <li key={i.label} className="card p-4">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">{i.label}</p><span className={`badge ${i.value ? "badge-green" : "badge-gray"}`}>{i.value ? "Provided" : "Missing"}</span></div>
              <p className="mt-2 truncate text-xs text-gray-500">{i.value ?? <Link href={i.href} className="underline hover:text-white">Add this input</Link>}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] px-4 py-3 sm:px-6">
          <h2 className="h2">Readiness matrix</h2>
          <div className="flex gap-1" role="group" aria-label="Filter checks">
            {(["ALL", "GREEN", "YELLOW", "RED"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-2.5 py-1 text-[11px] transition ${filter === f ? "bg-white text-black" : "text-gray-400 hover:bg-white/5"}`}>
                {f === "ALL" ? `All ${total}` : `${f.charAt(0)}${f.slice(1).toLowerCase()} ${count(f)}`}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0
          ? <p className="p-6 text-sm text-gray-500">No checks with this status.</p>
          : <ul className="divide-y divide-white/5">{shown.map((c) => (
            <li key={c.id} className="grid gap-2 px-4 py-3.5 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_76px_minmax(0,2fr)] md:items-start md:gap-5">
              <p className="text-sm font-medium">{c.name}</p>
              <span className={`badge w-fit ${badge[c.status]}`}>{c.status}</span>
              <p className="text-xs leading-5 text-gray-500">{c.evidence}{c.missing?.length ? <span className="mt-1 block text-gray-400">Missing: {c.missing.join(", ")}.</span> : null}</p>
            </li>
          ))}</ul>}
      </section>

      {report.nextActions.length > 0 && (
        <section className="card card-p mt-8">
          <h2 className="h2">To reach GREEN</h2>
          <p className="mt-0.5 text-sm text-gray-500">Evidence that has to exist before the matrix can change.</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {report.nextActions.map((a, i) => <li key={a} className="well flex gap-3 p-3 text-sm"><span className="text-gray-600">{i + 1}</span>{a.charAt(0).toUpperCase() + a.slice(1)}</li>)}
          </ol>
        </section>
      )}

      <div className="mt-8"><Callout tone="warn"><span className="font-medium">Current truth.</span> The research architecture is ready, but this package has no evidence from a pinned Arc repository or a runtime campaign. It stays YELLOW until the pinned-repository, runtime and reproduction checks are executed. No label can promote it by assertion.</Callout></div>
    </div>
  );
}
