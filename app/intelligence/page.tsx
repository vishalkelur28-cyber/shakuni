import PageHeader from "../../components/PageHeader";
import { Stat } from "../../components/ui";
import { buildCognitivePlan } from "../../lib/intelligence/human-brain";

const plan = buildCognitivePlan({
  program: "Arc",
  repository: "circlefin/arc-remote-signer",
  scopeAssets: ["authorized repository", "authorized research environment"],
  externalSignals: ["ArchSetu repository analysis"],
  githubSignals: ["PRs", "issues", "reviews", "commits"],
  invariants: ["unauthorized signer use must never occur"],
});

export default function IntelligencePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Research intelligence engine"
        description="A bounded cognitive architecture that explores independent research perspectives in parallel, retains evidence and contradictions, and converges on testable hypotheses. It scales through workers and models, not claims of unlimited cognition."
      />

      <section className="stat-grid mt-8">
        <Stat label="Thinking branches" value={plan.parallelBranches.length} />
        <Stat label="Memory buckets" value={plan.memoryBuckets.length} />
        <Stat label="Convergence rules" value={plan.convergenceRules.length} />
        <Stat label="Safety constraints" value={plan.safetyConstraints.length} />
      </section>

      <section className="mt-8">
        <h2 className="h2">Parallel research perspectives</h2>
        <p className="mt-0.5 text-sm text-gray-500">Each branch asks a different question of the same invariant.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plan.parallelBranches.map((branch) => (
            <article key={branch.id} className="card flex h-full flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-blue capitalize">{branch.perspective}</span>
                <span className="font-mono text-[11px] text-gray-600">{branch.id}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-200">{branch.question}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                {branch.evidenceNeeded.map((kind) => <span key={kind} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-500">{kind}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Convergence rules" items={plan.convergenceRules} />
        <Panel title="Persistent research memory" items={plan.memoryBuckets} mono />
      </section>

      <section className="card card-p mt-6">
        <h2 className="h2">Safety constraints</h2>
        <ul className="mt-3 grid gap-2 text-sm text-gray-400 sm:grid-cols-2">{plan.safetyConstraints.map((s) => <li key={s} className="well px-3 py-2">{s}</li>)}</ul>
      </section>
    </div>
  );
}

function Panel({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div className="card card-p">
      <h2 className="h2">{title}</h2>
      <ul className={`mt-3 divide-y divide-white/5 text-sm text-gray-400 ${mono ? "font-mono text-[13px]" : ""}`}>
        {items.map((item) => <li key={item} className="py-2 first:pt-0 last:pb-0">{item}</li>)}
      </ul>
    </div>
  );
}
