import {
  SHAKUNI_CONSTITUTION,
  buildAlternatePaths,
  type Hypothesis,
} from "../../lib/intelligence/constitution";
import PageHeader from "../../components/PageHeader";
import RuleSearch from "../../components/RuleSearch";
import { Stat } from "../../components/ui";

const demo: Hypothesis = {
  id: "demo-rs-001",
  statement: "An attacker-controlled request may reach a signing operation without the required authorization binding.",
  invariant: "Unauthorized input must never cause an unauthorized validator/private-key signature.",
  preconditions: ["Attacker can reach the authorized research entry point.", "Research environment is disposable/local."],
  status: "disproved",
  evidence: [
    {
      id: "ev-1",
      source: "archsetu",
      claim: "The signing path and entry points were identified during repository analysis.",
      strength: "moderate",
      supports: ["demo-rs-001"],
      contradicts: [],
      provenance: "ArchSetu imported analysis",
    },
    {
      id: "ev-2",
      source: "runtime",
      claim: "The proposed unauthorized path did not produce a signature in the sandbox.",
      strength: "decisive",
      supports: [],
      contradicts: ["demo-rs-001"],
      provenance: "Disposable research experiment",
    },
  ],
  alternatePaths: buildAlternatePaths(
    {
      id: "demo-rs-001",
      statement: "An attacker-controlled request may reach a signing operation without the required authorization binding.",
      invariant: "Unauthorized input must never cause an unauthorized validator/private-key signature.",
      preconditions: ["Attacker can reach the authorized research entry point.", "Research environment is disposable/local."],
      status: "candidate",
      evidence: [],
      alternatePaths: [],
      learnedRules: [],
    },
    "authorization",
    "The proposed direct path was blocked by an authorization check.",
  ),
  disproof: {
    reason: "authorization",
    explanation: "The sandboxed request reached authorization but did not cross the required signing boundary.",
    decisiveEvidenceIds: ["ev-2"],
    blockedPaths: ["direct-signing"],
  },
  learnedRules: [],
};

export default function ConstitutionPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Research constitution"
        description="The rules that govern how Shakuni researches, learns, handles disproof and continues investigation. Learning is evidence-backed and can never weaken a core invariant or manufacture a finding."
      />

      <section className="stat-grid mt-8">
        <Stat label="Constitutional rules" value={SHAKUNI_CONSTITUTION.length} />
        <Stat label="Alternate paths after disproof" value={demo.alternatePaths.length} />
        <Stat label="Evidence records (example)" value={demo.evidence.length} />
        <Stat label="Core principle" value={<span className="text-xl sm:text-2xl">Evidence first</span>} />
      </section>

      <section className="card card-p mt-8">
        <h2 className="h2">The rules</h2>
        <p className="mt-0.5 mb-4 text-sm text-gray-500">Every rule is enforced in code or required in review.</p>
        <RuleSearch rules={SHAKUNI_CONSTITUTION} />
      </section>

      <section className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="When a hypothesis is disproved" tone="red" items={[
          "Record exactly what disproved the hypothesis.",
          "Identify the blocked assumption or boundary.",
          "Preserve the evidence that caused disproof.",
          "Do not rerun the identical failed path.",
          "Generate alternate paths that change a testable assumption.",
          "Keep the original invariant unchanged.",
        ]} />
        <Panel title="How learning works" items={[
          "Learn only from verified, provenance-backed outcomes.",
          "Store the trigger, learned rule, and supporting evidence IDs.",
          "Keep provisional learning separate from validated learning.",
          "Require corroboration before promoting a learned rule.",
          "Never let learned rules override core safety or invariant rules.",
          "Every decision remains auditable and reproducible.",
        ]} />
      </section>

      <section className="card card-p mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Worked example</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Disproved → Explain → Branch → Test</h2>
          </div>
          <span className="badge badge-yellow">{demo.disproof?.reason}</span>
        </div>

        <p className="muted mt-4">{demo.disproof?.explanation}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {demo.alternatePaths.map((path) => (
            <article key={path.id} className="well p-4">
              <p className="break-all font-mono text-[11px] text-red-300">{path.id.replace(`${demo.id}-`, "")}</p>
              <p className="mt-2 text-sm text-white">{path.changedAssumption}</p>
              <p className="mt-2 text-sm text-gray-400">{path.nextQuestion}</p>
              <p className="mt-3 text-xs text-gray-600">{path.safety}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Panel({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "red" }) {
  return (
    <div className="card card-p">
      <h2 className={`h2 ${tone === "red" ? "text-red-300" : ""}`}>{title}</h2>
      <ol className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={item} className="flex gap-3 text-sm text-gray-400"><span className="w-4 shrink-0 text-gray-600">{i + 1}</span>{item}</li>
        ))}
      </ol>
    </div>
  );
}
