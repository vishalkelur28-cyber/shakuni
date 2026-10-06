import type { Analyst, AnalystInput, Branch, Contradiction, Intelligence } from "./types.ts";

/**
 * Deterministic, offline analyst. It reasons over the REAL evidence supplied -
 * it never invents source, PRs, test output, or exploit results, and never
 * decides the verdict. It builds the eight reasoning branches, a counterexample
 * (disprove) branch, preserves contradictions, and lists missing evidence.
 *
 * No AI/model is used anywhere: this is pure deterministic logic, so Shakuni
 * stays fully offline/closed and every run is reproducible.
 */

function heldHarnesses(input: AnalystInput) {
  return input.harnessSummaries.filter((h) => h.result === "HELD");
}
function brokenHarnesses(input: AnalystInput) {
  return input.harnessSummaries.filter((h) => h.result === "BROKEN");
}

function branchesFor(input: AnalystInput): Branch[] {
  const held = heldHarnesses(input);
  const broken = brokenHarnesses(input);
  const dirs = input.surface.topDirs ?? [];
  const fixPRs = input.prExcerpts.filter((p) => p.fixish);

  const mk = (name: Branch["name"], conclusion: string, support: string[], contra: string[], missing: string[], confidence: number): Branch =>
    ({ name, conclusion, supportingEvidence: support, contradictions: contra, missingEvidence: missing, confidence });

  return [
    mk("architecture",
      dirs.length ? `The invariant lives across ${dirs.slice(0, 3).map((d) => d.dir).join(", ")}; the relevant transition must be traced through these in-scope crates.` : "Architecture not mapped (no cloned directory inventory).",
      dirs.slice(0, 3).map((d) => `${d.dir} (${d.files} files) is in scope`),
      [], dirs.length ? [] : ["cloned directory inventory"], dirs.length ? 0.5 : 0.1),
    mk("attack_surface",
      typeof input.surface.entryPoints === "number" ? `${input.surface.entryPoints} entry points are attacker-reachable; the claimed attack must start at one of them.` : "Entry points unknown (no ArchSetu import).",
      typeof input.surface.entryPoints === "number" ? [`ArchSetu reports ${input.surface.entryPoints} entry points`] : [],
      [], typeof input.surface.entryPoints === "number" ? ["which entry point reaches the sensitive transition"] : ["entry-point analysis"], 0.4),
    mk("state",
      broken.length ? "A harness drove the state machine into a violating state." : held.length ? "Harnesses drove the state machine over randomized sequences without reaching a violating state." : "The relevant state transition has not been executed.",
      [...held.map((h) => `${h.property} HELD over ${h.cases.toLocaleString()} sequences`), ...broken.map((h) => `${h.property} BROKEN`)],
      [], broken.length ? [] : held.length ? ["a reachable sequence the current harness does not generate"] : ["any real execution"], broken.length ? 0.7 : 0.3),
    mk("identity",
      held.some((h) => /equivoc/i.test(h.property)) ? "Validator-identity de-duplication is enforced (equivocation-evidence harness held), so naive identity-reuse attacks are counted once." : "Identity/authorization binding for the sensitive action is unverified.",
      held.filter((h) => /equivoc/i.test(h.property)).map((h) => `${h.property} HELD`),
      [], held.some((h) => /equivoc/i.test(h.property)) ? [] : ["identity-binding harness"], 0.4),
    mk("economic",
      "This is a consensus-safety property; the impact is safety/finality, not a direct economic primitive. Economic loss would be a downstream consequence of a safety break, not the break itself.",
      [], [], ["a demonstrated path from a safety break to fund loss"], 0.3),
    mk("history",
      fixPRs.length ? `The area was recently changed by ${fixPRs.length} merged fix/security PR(s); the hypothesis may predate the fix or target an adjacent path.` : "No recent fix PRs touch this area in the imported data.",
      fixPRs.map((p) => p.label),
      [], ["whether any fix landed before the pinned commit (if so, the current commit may not be affected)"], 0.4),
    mk("dependencies",
      input.surface.languages ? `Primary language ${Object.keys(input.surface.languages)[0] ?? "unknown"}; dependency-level interaction is out of the current harness scope.` : "Dependency surface unknown.",
      input.surface.languages ? [`languages ${Object.entries(input.surface.languages).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(", ")}`] : [],
      [], ["dependency-interaction harness"], 0.2),
    // Counterexample / disprove branch, mandatory.
    mk("counterexample",
      counterexampleConclusion(input),
      held.map((h) => `${h.property} HELD → the protective mechanism it checks is effective for the cases searched`),
      broken.length ? [] : held.map((h) => `${h.property} held, which argues against the hypothesis`),
      ["the specific unguarded path (if any) the current harness does not cover"],
      broken.length ? 0.6 : 0.5),
  ];
}

function counterexampleConclusion(input: AnalystInput): string {
  const held = heldHarnesses(input);
  if (brokenHarnesses(input).length) return "Assume the hypothesis is wrong: no protective mechanism prevented the observed violation, because a harness reproduced it. The counterexample FAILS to defeat the hypothesis.";
  if (held.length) return "Assume the hypothesis is wrong: the observed behavior is explained by an existing mechanism (de-duplication / quorum enforcement / round-change rules) that the HELD harnesses exercise. The hypothesis survives only as an untested lead on paths the harness does not yet cover, absence of a violation is not disproof.";
  return "Assume the hypothesis is wrong: no execution has yet distinguished a real defect from an existing protection. The discriminating experiment has not been run.";
}

function contradictionsFor(input: AnalystInput): Contradiction[] {
  const out: Contradiction[] = [...(input.priorContradictions ?? [])];
  const held = heldHarnesses(input);
  const broken = brokenHarnesses(input);
  // The hypothesis claims a violation while a harness shows the invariant holds.
  if (held.length && !broken.length) {
    out.push({
      a: input.hypothesis.claim,
      b: `${held.map((h) => h.property).join(", ")} HELD over randomized inputs → the invariant holds for the cases searched.`,
      resolution: "Unresolved. Absence of a violation is not proof of safety; the harness may not generate the unguarded sequence. Neither claim is discarded.",
      resolvingExperiment: "Widen the harness (more rounds/validators, the specific entry point and state sequence named by the hypothesis) and re-run; a continued HELD weakens the hypothesis, a BROKEN confirms it.",
      resolved: false,
    });
  }
  return out;
}

export const heuristicAnalyst: Analyst = {
  name: "deterministic-offline-v1",
  analyze(input: AnalystInput): Intelligence {
    const branches = branchesFor(input);
    const contradictions = contradictionsFor(input);
    const broken = brokenHarnesses(input);
    const held = heldHarnesses(input);

    const overallAssessment = broken.length
      ? "A harness reproduced a violation on real code. This is evidence; it still requires minimization, a passing negative control, independent reproduction, demonstrated impact, and current-commit confirmation before it is a finding."
      : held.length
        ? "The real implementation was executed and the stated invariants held across randomized inputs. This is an interesting lead with no reproduced violation; the next step is a discriminating experiment, not more random cases."
        : "No real execution has distinguished a defect from an existing protection. The hypothesis is unproven.";

    return {
      analyst: this.name,
      overallAssessment,
      branches,
      contradictions,
      strongestArgumentFor: broken.length
        ? ["A real harness reproduced a violation of the stated invariant on the pinned code."]
        : ["The hypothesis targets a critical consensus-safety property with a plausible attacker-controlled path."],
      strongestArgumentAgainst: held.length
        ? held.map((h) => `${h.property} held over ${h.cases.toLocaleString()} randomized sequences, so the naive version of the attack is prevented.`)
        : ["No execution has produced a violation."],
      nextExperiments: broken.length
        ? ["Minimize the counterexample.", "Run the negative control.", "Reproduce independently from a clean clone.", "Demonstrate concrete impact.", "Confirm the pinned commit is affected."]
        : ["Widen an existing harness to the specific unguarded path named by the hypothesis.", "Add a harness for any lead still pending a template.", "Check whether a merged fix PR landed before the pinned commit."],
      evidenceRequests: broken.length
        ? ["minimized reproducer", "negative control result", "independent reproduction", "impact measurement", "current-commit confirmation"]
        : ["a discriminating experiment that would separate a real defect from an existing protection"],
    };
  },
};

export function defaultAnalyst(): Analyst {
  return heuristicAnalyst;
}
