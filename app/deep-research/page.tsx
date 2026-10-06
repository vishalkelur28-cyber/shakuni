"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { Callout, EmptyState, Stat } from "../../components/ui";
import { createDeepResearchCase, generateAlternateResearchPaths, queueSafeExperiment, recordObservation, finalizeResearchCase, canConfirm, attachExperimentOutcome, type ExecutedExperiment } from "../../lib/research/deep-loop";
import type { Hypothesis } from "../../lib/intelligence/constitution";

const demo: Hypothesis = {
  id: "H-ARC-DEMO-001",
  statement: "Could an attacker-controlled consensus message reach a sensitive state transition without the required authorization/invariant check?",
  invariant: "Unauthorized consensus input must never cause an invalid state transition.",
  preconditions: ["Attacker can submit a message to an authorized local/testnet harness.", "A reachable parser/validation path exists."],
  status: "candidate",
  evidence: [],
  alternatePaths: [],
  learnedRules: [],
};

const statusBadge: Record<string, string> = {
  disproved: "badge-red",
  survives: "badge-green",
  running: "badge-blue",
  queued: "badge-gray",
  blocked: "badge-yellow",
  complete: "badge-green",
};

export default function DeepResearchPage() {
  const [researchCase, setCase] = useState(() => createDeepResearchCase(demo));
  const [selected, setSelected] = useState(researchCase.branches[0].id);
  const [notice, setNotice] = useState<{ tone: "info" | "ok" | "warn"; text: string } | null>(null);

  // Runtime (fork) config, real forge run against a local Arc testnet fork.
  const [fork, setFork] = useState({
    projectDir: "",
    testContract: "MintConservationInvariant",
    invariantFn: "invariant_erc20BalanceEqualsNativeBalance",
    negativeControlFn: "invariant_negativeControl_parityHoldsAtStart",
    forkRpcUrl: "http://127.0.0.1:8545",
    forkBlock: "",
    forgeBin: "arc-forge",
  });
  const [running, setRunning] = useState(false);

  const runForkExperiment = async (planId: string) => {
    if (!fork.projectDir || !fork.forkBlock) {
      setNotice({ tone: "warn", text: "Set the Foundry project path and a pinned fork block before running." });
      return;
    }
    setRunning(true);
    setNotice({ tone: "info", text: "Running forge against the fork. This spawns a real process and may take a while." });
    try {
      const res = await fetch("/api/runtime/fork-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          projectDir: fork.projectDir,
          testContract: fork.testContract,
          invariantFn: fork.invariantFn,
          negativeControlFn: fork.negativeControlFn || undefined,
          forkRpcUrl: fork.forkRpcUrl,
          forkBlock: Number(fork.forkBlock),
          chainId: 5042002,
          forgeBin: fork.forgeBin || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "warn", text: `Run failed: ${data.error ?? "unknown error"}` });
        return;
      }
      const experiment = data.experiment as ExecutedExperiment;
      setCase((c) => attachExperimentOutcome(c, experiment));
      const broke = experiment.invariantResult === "FAIL";
      setNotice({
        tone: broke ? "ok" : "info",
        text: broke
          ? `Invariant BROKEN on real forked contract. Candidate finding recorded with trace ${experiment.traceHash.slice(0, 12)}. Reproduce independently next.`
          : `Ran cleanly. Result: ${experiment.invariantResult}. ${data.reason ?? ""}`,
      });
    } catch (e) {
      setNotice({ tone: "warn", text: `Could not reach the runtime route: ${e instanceof Error ? e.message : "error"}` });
    } finally {
      setRunning(false);
    }
  };

  const selectedBranch = researchCase.branches.find((b) => b.id === selected) ?? researchCase.branches[0];
  const branchExperiments = researchCase.experiments.filter((e) => e.branchId === selectedBranch.id);
  const confirmation = useMemo(() => canConfirm(researchCase), [researchCase]);
  const closed = researchCase.stage === "closed";
  const hasAlternates = researchCase.branches.some((b) => b.parentId === selected && b.id.startsWith(`${selected}-alt-`));
  const disprovedCount = researchCase.branches.filter((b) => b.status === "disproved").length;

  const addObservation = (contradicts = false) => {
    setCase((c) => recordObservation(c, selected, {
      stage: contradicts ? "counterexample" : "evidence",
      claim: contradicts ? "Controlled evidence contradicts the current branch assumption." : "Controlled evidence supports continued investigation.",
      supports: contradicts ? [] : [c.hypothesis.id],
      contradicts: contradicts ? [c.hypothesis.id] : [],
      evidenceIds: [],
      assumptionChanged: contradicts ? "The original reachability assumption." : undefined,
    }));
    setNotice(contradicts
      ? { tone: "warn", text: "Counterexample recorded. This branch is now disproved. Generate alternate paths to keep researching without repeating it." }
      : { tone: "ok", text: "Supporting observation recorded." });
  };

  const addGateObservation = (stage: "reproduction" | "impact") => {
    setCase((c) => recordObservation(c, selected, {
      stage,
      claim: stage === "reproduction"
        ? "Break independently reproduced from a clean fork."
        : "Attacker impact demonstrated on the fork.",
      supports: [c.hypothesis.id],
      contradicts: [],
      evidenceIds: [],
    }));
    setNotice({ tone: "ok", text: stage === "reproduction" ? "Independent reproduction recorded." : "Demonstrated impact recorded." });
  };

  const addExperiment = () => {
    setCase((c) => queueSafeExperiment(c, selected, `Test the branch question: ${selectedBranch.question}`, "local"));
    setNotice({ tone: "ok", text: "Local experiment queued with positive and negative controls." });
  };

  const branch = () => {
    if (hasAlternates) { setNotice({ tone: "info", text: "Alternate paths for this branch already exist. Pick one from the list." }); return; }
    setCase((c) => ({ ...c, branches: [...c.branches, ...generateAlternateResearchPaths(c, selected, "Current path produced contradictory evidence.")] }));
    setNotice({ tone: "ok", text: "Six alternate paths added. Each changes one assumption and keeps the invariant fixed." });
  };

  const close = (conclusion: "disproved" | "inconclusive" | "reproduced" | "confirmed") => {
    const result = finalizeResearchCase(researchCase, conclusion);
    setCase(result);
    setNotice(result.conclusion === conclusion
      ? { tone: "ok", text: `Case closed as ${conclusion}.` }
      : { tone: "warn", text: `Confirmation blocked. The case stays open. Missing: ${canConfirm(researchCase).missing.join(", ")}.` });
  };

  const reset = () => {
    const fresh = createDeepResearchCase(demo);
    setCase(fresh);
    setSelected(fresh.branches[0].id);
    setNotice({ tone: "info", text: "Case reset to the sample hypothesis." });
  };

  const act = "btn btn-sm";

  return <div>
    <PageHeader
      step="research"
      eyebrow="Deep research"
      title="One hypothesis, many independent paths"
      description="Investigate architecture, attack surface, history, state, identity and counterexamples as separate branches. Contradictions are preserved, never discarded."
      aside={<span className="badge badge-green self-start md:self-auto">Mainnet blocked · Human approval required</span>}
    />

    <div className="mt-6"><Callout>Branch and observation actions are bookkeeping on a built-in sample hypothesis. The runtime panel below runs a real forge invariant test against a local fork you configure, and only that produces decisive evidence.</Callout></div>

    <div className="mt-3"><Callout tone="info">This page is the manual, EVM-fork workbench. For the one-click flow that selects an in-scope target, clones it, runs real harnesses and gives a submit/no-submit verdict, use <Link href="/autonomous" className="underline font-medium">Autonomous hunt</Link>, the hub that ties program scope, analysis, GitHub evidence and this runtime together.</Callout></div>

    <div className="stat-grid mt-6">
      <Stat label="Branches" value={researchCase.branches.length} hint={disprovedCount ? `${disprovedCount} disproved` : undefined} />
      <Stat label="Experiments" value={researchCase.experiments.length} />
      <Stat label="Observations" value={researchCase.observations.length} />
      <Stat label="Case status" value={<span className="text-lg capitalize sm:text-2xl">{researchCase.conclusion ?? researchCase.stage}</span>} />
    </div>

    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.5fr)]">
      <aside className="card p-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto" aria-label="Research branches">
        <p className="kicker px-2 pb-2 pt-1">Branches · {researchCase.branches.length}</p>
        <ul className="space-y-1.5">
          {researchCase.branches.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setSelected(b.id)} aria-pressed={selected === b.id} className={`w-full rounded-xl border p-3 text-left transition ${selected === b.id ? "border-accent/50 bg-accent/[.06]" : "border-transparent hover:bg-white/[.04]"}`}>
                <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{b.id.replace(`${demo.id}-`, "")}</span><span className={`badge ${statusBadge[b.status] ?? "badge-gray"}`}>{b.status}</span></span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-gray-500">{b.question}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0 space-y-6">
        <div className="card card-p">
          <p className="kicker">Hypothesis</p>
          <h2 className="mt-2 text-lg font-semibold leading-snug sm:text-xl">{researchCase.hypothesis.statement}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="well p-4"><p className="text-xs text-gray-500">Invariant</p><p className="mt-1.5 text-sm text-gray-200">{researchCase.hypothesis.invariant}</p></div>
            <div className="well p-4"><p className="text-xs text-gray-500">Preconditions</p><ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-300">{researchCase.hypothesis.preconditions.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
        </div>

        <div className="card card-p">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="kicker">Selected branch</p><h3 className="mt-1 break-all font-semibold">{selectedBranch.id}</h3></div>
            <div className="flex shrink-0 gap-1.5"><span className="badge badge-gray">{selectedBranch.stage}</span><span className={`badge ${statusBadge[selectedBranch.status] ?? "badge-gray"}`}>{selectedBranch.status}</span></div>
          </div>
          <p className="muted mt-3">{selectedBranch.purpose}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={closed} onClick={() => addObservation(false)} className={`${act} btn-primary`}>Record supporting evidence</button>
            <button type="button" disabled={closed} onClick={() => addObservation(true)} className={`${act} btn-ghost !border-yellow-500/30 !text-yellow-300`}>Record counterexample</button>
            <button type="button" disabled={closed} onClick={() => addGateObservation("reproduction")} className={`${act} btn-ghost`}>Record independent reproduction</button>
            <button type="button" disabled={closed} onClick={() => addGateObservation("impact")} className={`${act} btn-ghost`}>Record demonstrated impact</button>
            <button type="button" disabled={closed} onClick={addExperiment} className={`${act} btn-ghost`}>Queue safe local experiment</button>
            <button type="button" disabled={closed || hasAlternates} onClick={branch} className={`${act} btn-ghost`}>{hasAlternates ? "Alternates generated" : "Generate alternate paths"}</button>
          </div>
          {notice && <div className="mt-4"><Callout tone={notice.tone} role="status">{notice.text}</Callout></div>}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="kicker">Observations on this branch</p>
              {selectedBranch.observations.length === 0
                ? <div className="mt-2"><EmptyState title="Nothing recorded" body="Record supporting evidence or a counterexample above." /></div>
                : <ul className="mt-2 space-y-2">{selectedBranch.observations.map((o) => (
                  <li key={o.id} className="well p-3 text-xs leading-5">
                    <span className={`badge ${o.contradicts.length ? "badge-red" : "badge-green"}`}>{o.stage}</span>
                    <p className="mt-1.5 text-gray-300">{o.claim}</p>
                    {o.assumptionChanged && <p className="mt-1 text-gray-500">Assumption challenged: {o.assumptionChanged}</p>}
                  </li>
                ))}</ul>}
            </div>
            <div>
              <p className="kicker">Experiments on this branch</p>
              {branchExperiments.length === 0
                ? <div className="mt-2"><EmptyState title="None queued" body="Queue a safe local experiment to define controls and required evidence." /></div>
                : <ul className="mt-2 space-y-2">{branchExperiments.map((e) => (
                  <li key={e.id} className="well p-3 text-xs leading-5">
                    <div className="flex items-center justify-between gap-2"><span className="break-all font-mono text-[11px] text-gray-500">{e.id.split("-exp-")[1] ? `exp-${e.id.split("-exp-")[1]}` : e.id}</span><span className="badge badge-gray">{e.environment}</span></div>
                    <p className="mt-1.5 text-gray-300">{e.objective}</p>
                    <p className="mt-1.5 text-gray-500">Needs: {e.requiredEvidence.length} evidence items · positive and negative control</p>
                  </li>
                ))}</ul>}
            </div>
          </div>
        </div>

        <div className="card card-p">
          <div className="flex items-start justify-between gap-3">
            <div><p className="kicker">Runtime · fork invariant test</p><h3 className="mt-1 font-semibold">Run a real forge test against a local Arc fork</h3></div>
            <span className="badge badge-green self-start">Local only · mainnet blocked</span>
          </div>
          <p className="muted mt-3">This spawns <code className="font-mono text-xs">forge</code> on your machine against a fork you started with arc-anvil. A FAIL is a real invariant break on real forked bytecode. The run receipt (trace hash + fork fingerprint) records that it happened; it is not a substitute for independently reproducing the break, which the gate still requires.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block"><span className="text-xs text-gray-500">Foundry project path</span>
              <input className="input mt-1" placeholder="D:\Shakuni-Arc-Deep-Research-Ready-v2\foundry" value={fork.projectDir} onChange={(e) => setFork({ ...fork, projectDir: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Fork RPC URL (local or testnet)</span>
              <input className="input mt-1" value={fork.forkRpcUrl} onChange={(e) => setFork({ ...fork, forkRpcUrl: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Test contract</span>
              <input className="input mt-1" value={fork.testContract} onChange={(e) => setFork({ ...fork, testContract: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Invariant function</span>
              <input className="input mt-1" value={fork.invariantFn} onChange={(e) => setFork({ ...fork, invariantFn: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Negative control function</span>
              <input className="input mt-1" value={fork.negativeControlFn} onChange={(e) => setFork({ ...fork, negativeControlFn: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Pinned fork block</span>
              <input className="input mt-1" inputMode="numeric" placeholder="same block arc-anvil forked at" value={fork.forkBlock} onChange={(e) => setFork({ ...fork, forkBlock: e.target.value.replace(/[^0-9]/g, "") })} /></label>
            <label className="block"><span className="text-xs text-gray-500">Forge binary (arc-forge for Arc)</span>
              <input className="input mt-1" value={fork.forgeBin} onChange={(e) => setFork({ ...fork, forgeBin: e.target.value })} /></label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {branchExperiments.length === 0
              ? <span className="muted text-xs">Queue a safe local experiment on this branch first, then run it here.</span>
              : branchExperiments.map((e) => (
                <button key={e.id} type="button" disabled={closed || running} onClick={() => runForkExperiment(e.id)} className={`${act} btn-primary`}>
                  {running ? "Running forge..." : `Run ${e.id.split("-exp-")[1] ? `exp-${e.id.split("-exp-")[1]}` : e.id} on fork`}
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/25 bg-red-500/[.05] p-5 sm:p-6">
          <p className="kicker !text-red-300">Confirmation gate</p>
          <p className="mt-2 text-sm text-gray-300">A hypothesis is not confirmed because a test succeeded. All of these must be true first:</p>
          <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            {["Decisive runtime evidence", "Passed negative control", "Independent reproduction observation", "Demonstrated impact observation"].map((req) => {
              const missing = confirmation.missing.includes(req);
              return <li key={req} className={`flex items-center gap-2 ${missing ? "text-gray-400" : "text-green-300"}`}><span aria-hidden>{missing ? "○" : "●"}</span>{req}</li>;
            })}
          </ul>
          {researchCase.conclusion && <p className="mt-4 text-sm">Conclusion: <b className="capitalize">{researchCase.conclusion}</b></p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={closed} onClick={() => close("disproved")} className={`${act} btn-ghost`}>Close as disproved</button>
            <button type="button" disabled={closed} onClick={() => close("inconclusive")} className={`${act} btn-ghost`}>Close inconclusive</button>
            <button type="button" disabled={closed} onClick={() => close("reproduced")} className={`${act} btn-ghost`}>Mark reproduced</button>
            <button type="button" disabled={closed} onClick={() => close("confirmed")} className={`${act} btn-primary`}>Attempt confirmation</button>
            {closed && <button type="button" onClick={reset} className={`${act} btn-ghost`}>Start over</button>}
          </div>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className="card card-p"><p className="kicker">Decision log</p><ul className="mt-3 space-y-2 text-xs leading-5 text-gray-400">{researchCase.decisions.map((d, i) => <li key={i}>• {d}</li>)}</ul></div>
          <div className="card card-p"><p className="kicker">Hard safety constraints</p><ul className="mt-3 space-y-2 text-xs leading-5 text-gray-400">{researchCase.blockedActions.map((x) => <li key={x}>• {x}</li>)}</ul></div>
        </div>
      </section>
    </div>
  </div>;
}
