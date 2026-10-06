"use client";

import Link from "next/link";
import { FLOW_STEPS, REFERENCE_PAGES } from "../lib/workspace/flow";
import { useWorkspace } from "../lib/workspace/store";

export default function Home() {
  const { state, ready } = useWorkspace();

  const inputs = [
    { step: FLOW_STEPS[0], value: state.program ? `${state.program.name} · ${state.program.assets.length} assets` : null },
    { step: FLOW_STEPS[1], value: state.analyses.length ? state.analyses.map((a) => a.repository).join(", ") : null },
    { step: FLOW_STEPS[2], value: state.github ? `${state.github.repos.join(", ")} · ${state.github.records.length} records` : null },
  ];
  const firstOpen = inputs.findIndex((i) => !i.value);
  const doneCount = inputs.filter((i) => i.value).length;
  const next = firstOpen === -1 ? FLOW_STEPS[3] : FLOW_STEPS[firstOpen];
  const resuming = ready && doneCount > 0;

  return (
    <div>
      <section className="max-w-3xl">
        <p className="kicker text-accent">Authorized research only</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Evidence first. Verdict last.</h1>
        <p className="mt-4 text-base leading-7 text-gray-400">
          Take an authorized bug bounty target from program scope to a reproducible, human-reviewed finding in six steps. Static signals are leads, never proof.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href={next.href} className="btn btn-primary px-6 py-3">
            {resuming ? `Continue: ${next.title}` : "Start with Program Intake"} <span aria-hidden>→</span>
          </Link>
          <span className="text-xs text-gray-500">Mainnet is hard-blocked. Human approval is required to confirm.</span>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="ws">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="ws" className="h2">Your workspace</h2>
          <p className="text-xs text-gray-500">{ready ? `${doneCount} of 3 inputs ready` : " "}</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {inputs.map(({ step, value }) => (
            <li key={step.id}>
              <Link href={step.href} className="card block h-full p-4 transition hover:bg-raised">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{step.title}</p>
                  <span className={`badge ${value ? "badge-green" : "badge-gray"}`}>{value ? "Ready" : "Not started"}</span>
                </div>
                <p className="mt-2 truncate text-xs text-gray-500">{value ?? step.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="flow">
        <h2 id="flow" className="h2 mb-3">The workflow</h2>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FLOW_STEPS.map((s) => (
            <li key={s.id}>
              <Link href={s.href} className="card group block h-full p-5 transition hover:border-white/20 hover:bg-raised">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-gray-400 transition group-hover:border-accent group-hover:text-accent">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="muted mt-1.5">{s.blurb}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="ref">
        <h2 id="ref" className="h2 mb-3">Reference</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REFERENCE_PAGES.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="card block h-full p-4 transition hover:bg-raised">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{r.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
