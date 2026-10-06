import type { AutoFinding } from "./finding.ts";
import type { Manifest } from "./ingest.ts";
import type { HarnessResult } from "./rust-harness.ts";
import type { IntelligenceResult } from "./intelligence/types.ts";

/** The product's submit/no-submit call, shown at the top of the dossier. */
export interface Verdict {
  submit: boolean;
  label: string;
  reasons: string[];
}

/** One entry in the self-generated harness plan: a lead, whether a harness exists, why it runs. */
export interface HarnessPlanItem {
  leadId: string;
  leadTitle: string;
  status: "generated-and-run" | "pending-no-template";
  property?: string;
  crate?: string;
  result?: "HELD" | "BROKEN" | "ERROR";
  /** PRs from imported data that flag this area and triggered/justify this harness. */
  triggerPRs: { label: string; url?: string }[];
  note: string;
}

/**
 * Standard report shapes for the autonomous engine.
 *
 * The hard rule: every claim carries an honesty label. The engine may reach
 * "reproduced-in-model" on its own; it may NEVER emit "confirmed" for a real
 * target. Only a human, after reproducing against the real implementation,
 * promotes a lead to confirmed in Shakuni's confirmation gate.
 */
export type ClaimKind =
  | "observed"            // directly read from imported data (a PR exists, ArchSetu says N entry points)
  | "inference"           // derived from observed data
  | "hypothesis"          // a candidate the engine proposes; UNTESTED against the real target
  | "reproduced-in-model" // reproduced in an executable model the engine controls (e.g. the synthetic benchmark)
  | "confirmed";          // reserved for human-validated, real-target reproduction. The engine never sets this.

export type HypothesisStatus = "UNTESTED" | "PLAUSIBLE" | "DISPROVEN";

export interface CrossRef {
  source: "github-pr" | "github-record" | "archsetu" | "repo-path";
  label: string;        // what matched
  detail: string;       // why it is relevant
  url?: string;
  /** "in-scope-code" points a lead at real cloned directories; others as named. */
  signal: "recently-touched" | "possibly-fixed" | "attack-surface" | "context" | "in-scope-code";
}

export interface RepoHypothesis {
  id: string;
  title: string;
  vulnClass: string;
  /** Keywords used to cross-reference PRs and ArchSetu. */
  area: string[];
  rationale: string;
  status: HypothesisStatus;
  /** Low by construction: nothing here is tested against the real code yet. */
  confidence: "low" | "medium";
  toConfirm: string[];     // the exact steps that would turn this lead into evidence
  crossRefs: CrossRef[];   // filled by the cross-check layer from imported data
  priority: number;        // computed rank
}

export interface AutonomousReport {
  generatedAt: string;
  engineVersion: string;
  /** How the product chose this target on its own. */
  selection?: { reasons: string[]; ranking: { repository: string; score: number }[] };
  /** The cloned, commit-pinned, scope-filtered local copy that was hunted. */
  ingestion?: Manifest;
  target: {
    repository: string;
    maxSeverity: string | null;
    inScope: boolean;
    scopeNote: string | null;
    bountyEligible: boolean | null;
  };
  /** Proof that the discover→prove→gate pipeline works, run on a model the engine can execute. */
  capabilityProof: {
    finding: AutoFinding;
    replaysRun: number;
    note: string;
  };
  surface: {
    archsetu: { present: boolean; files?: number; functions?: number; deadCode?: number; entryPoints?: number; languages?: Record<string, number> };
    github: { present: boolean; records: number; pullRequests: number };
  };
  /** Real executable harnesses that actually ran against the cloned code. */
  executed: HarnessResult[];
  /** What the product decided to generate/run per lead, and why. */
  generation: HarnessPlanItem[];
  /** A drafted submission, present only when a harness returned BROKEN. */
  draftReport?: string;
  /** Reasoning branches + the deterministic evidence-gate adjudication for the top lead. */
  intelligence?: IntelligenceResult;
  /** The product's submit/no-submit call (derived from the gate). */
  verdict: Verdict;
  hypotheses: RepoHypothesis[];
  limitations: string[];
  humanReviewRequired: true;
}

function sevLine(s: string | null) { return s ? s.toUpperCase() : "unspecified"; }

/** Render a report as reviewer-facing markdown. Honesty labels are kept inline. */
export function renderReportMarkdown(r: AutonomousReport): string {
  const L: string[] = [];
  L.push(`# Autonomous research report, ${r.target.repository}`);
  L.push(`*Generated ${r.generatedAt} · engine ${r.engineVersion} · **human review required before any submission***`);
  L.push("");
  L.push(`## Verdict: ${r.verdict.submit ? "REVIEW FOR SUBMISSION" : "DO NOT SUBMIT"}`);
  L.push(`**${r.verdict.label}**`);
  for (const reason of r.verdict.reasons) L.push(`- ${reason}`);
  L.push("");
  if (r.intelligence) {
    const it = r.intelligence;
    L.push(`## Intelligence (reasoning advises; the deterministic gate decides)`);
    L.push(`Adjudicated state: **${it.gate.verdict}**, ${it.gate.reason}`);
    L.push(`Analyst: ${it.intelligence.analyst}. ${it.intelligence.overallAssessment}`);
    L.push(``);
    L.push(`Evidence gate (AI cannot override):`);
    for (const [k, v] of Object.entries(it.gate.gates)) L.push(`- ${v === "PASS" ? "✓" : "✗"} ${k}`);
    L.push(``);
    L.push(`Reasoning branches:`);
    for (const b of it.intelligence.branches) {
      L.push(`- **${b.name}**, ${b.conclusion}`);
      if (b.contradictions.length) L.push(`  - contradictions: ${b.contradictions.join("; ")}`);
      if (b.missingEvidence.length) L.push(`  - missing: ${b.missingEvidence.join("; ")}`);
    }
    if (it.intelligence.contradictions.length) {
      L.push(``);
      L.push(`Contradictions preserved:`);
      for (const c of it.intelligence.contradictions) {
        L.push(`- A: ${c.a}`);
        L.push(`  B: ${c.b}`);
        L.push(`  → ${c.resolution} Resolving experiment: ${c.resolvingExperiment}`);
      }
    }
    L.push("");
  }
  if (r.executed.length) {
    L.push(`## Executed harnesses (ran against the real cloned code)`);
    for (const h of r.executed) {
      L.push(`- **${h.result}**, \`${h.property}\` on \`${h.crate}\` at commit \`${h.commit.slice(0, 12)}\`: ${h.iters.toLocaleString()} sequences, ${h.quorumsVerified.toLocaleString()} checks verified, ${h.violations} violations (${h.seconds}s).`);
      if (h.counterexample) L.push(`  - Counterexample: ${h.counterexample}`);
    }
    L.push("");
  }
  if (r.draftReport) {
    L.push(`## Drafted submission (a harness returned BROKEN, review before sending)`);
    L.push(r.draftReport);
    L.push("");
  }
  if (r.generation.length) {
    L.push(`## Self-generated harness plan (what the product chose to run, and why)`);
    for (const g of r.generation) {
      const head = g.status === "generated-and-run"
        ? `**${g.leadTitle}** → generated \`${g.property}\` on \`${g.crate}\`${g.result ? ` → **${g.result}**` : ""}`
        : `**${g.leadTitle}** → no harness template yet (pending)`;
      L.push(`- ${head}`);
      L.push(`  - ${g.note}`);
      for (const pr of g.triggerPRs) L.push(`  - flagged by ${pr.label}${pr.url ? ` (${pr.url})` : ""}`);
    }
    L.push("");
  }
  L.push(`## Target`);
  L.push(`- Repository: \`${r.target.repository}\``);
  L.push(`- In scope: ${r.target.inScope ? "yes" : "NO, do not test"} · bounty-eligible: ${r.target.bountyEligible === null ? "unknown" : r.target.bountyEligible}`);
  L.push(`- Max severity (program): ${sevLine(r.target.maxSeverity)}`);
  if (r.target.scopeNote) L.push(`- Scope note: ${r.target.scopeNote}`);
  L.push("");
  if (r.selection) {
    L.push(`## Target selection (chosen autonomously)`);
    L.push(`Picked \`${r.target.repository}\` because: ${r.selection.reasons.join("; ")}.`);
    L.push(`Ranking: ${r.selection.ranking.map((x) => `${x.repository.replace("circlefin/", "")} ${x.score}`).join(" · ")}`);
    L.push("");
  }
  if (r.ingestion) {
    const m = r.ingestion;
    L.push(`## Local ingestion (cloned into local dev, commit-pinned)`);
    L.push(`- Clone: \`${m.path}\` at commit \`${m.commit}\` (${m.branch}), ${m.clonedAt}`);
    L.push(`- In-scope files: ${m.inScopeFiles} of ${m.totalFiles} (${Math.round(m.inScopeBytes / 1024)} KB), languages ${Object.entries(m.languages).map(([k, v]) => `${k} ${v}%`).join(", ")}`);
    if (m.scopeNote) L.push(`- Scope boundary applied: ${m.scopeNote}`);
    L.push(`- Largest in-scope areas: ${m.topDirs.slice(0, 6).map((d) => `${d.dir} (${d.files})`).join(", ")}`);
    L.push("");
  }
  L.push(`## Capability proof (how the engine proves a finding)`);
  const f = r.capabilityProof.finding;
  L.push(`Run on an executable model the engine controls, to show the discover→minimize→causal→replay→impact→gate pipeline is real:`);
  L.push(`- Status: **${f.status}** (reproduced-in-model)`);
  L.push(`- Discovered without the answer, minimal reproduction: \`${f.minimalPath.join(" → ")}\``);
  L.push(`- Every step proven necessary: ${f.causalControls.every((c) => c.necessary) ? "yes" : "no"}`);
  L.push(`- Independent replays from fresh state: ${f.replays.filter((x) => x.hit).length}/${r.capabilityProof.replaysRun} reproduced`);
  if (f.impact) L.push(`- Measured impact: ${f.impact.summary}`);
  L.push(`- ${r.capabilityProof.note}`);
  L.push("");
  L.push(`## Attack surface (from imported analysis)`);
  const a = r.surface.archsetu;
  L.push(a.present
    ? `- ArchSetu: ${a.files ?? "?"} files, ${a.functions ?? "?"} functions, ${a.deadCode ?? "?"} dead-code, ${a.entryPoints ?? "?"} entry points${a.languages ? `, languages ${Object.entries(a.languages).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(", ")}` : ""}`
    : `- ArchSetu: not imported for this repo (import it on the Repository Analysis page to enrich this report).`);
  L.push(r.surface.github.present
    ? `- GitHub: ${r.surface.github.records} records, ${r.surface.github.pullRequests} pull requests imported`
    : `- GitHub: not imported for this repo (import it on the GitHub Evidence page).`);
  L.push("");
  L.push(`## Ranked hypotheses (LEADS, untested against the real code)`);
  L.push(`> Each is a candidate the engine proposes from the attack surface and a security taxonomy. None is a confirmed vulnerability. "To confirm" lists what would turn a lead into evidence.`);
  L.push("");
  r.hypotheses.forEach((h, i) => {
    L.push(`### ${i + 1}. ${h.title}  _(${h.status.toLowerCase()}, confidence ${h.confidence})_`);
    L.push(`- Class: ${h.vulnClass}`);
    L.push(`- Why: ${h.rationale}`);
    if (h.crossRefs.length) {
      L.push(`- Cross-checked against imported data:`);
      for (const c of h.crossRefs) L.push(`  - [${c.signal}] ${c.label}, ${c.detail}${c.url ? ` (${c.url})` : ""}`);
    } else {
      L.push(`- Cross-checked against imported data: no matching PRs or ArchSetu signals found.`);
    }
    L.push(`- To confirm: ${h.toConfirm.map((s) => `(${s})`).join(" → ")}`);
    L.push("");
  });
  L.push(`## Limitations`);
  for (const lim of r.limitations) L.push(`- ${lim}`);
  L.push("");
  L.push(`## Status: LEADS ONLY, nothing here is a confirmed or exploitable vulnerability.`);
  L.push(`A finding becomes reportable only after it is reproduced against the real implementation, minimized, causally validated, replayed, impact-measured, and human-reviewed.`);
  return L.join("\n");
}
