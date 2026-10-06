import type { ExternalAnalysis } from "../external-analysis/types.ts";
import type { GitHubRecord } from "../github/types.ts";
import { crossCheck } from "./crosscheck.ts";
import { hunt } from "./engine.ts";
import { annotatePlan, draftSubmission, planHarnesses } from "./generator.ts";
import { harnessForLead } from "./harness-registry.ts";
import { hypothesesFor, isKnownTarget } from "./hypotheses.ts";
import { runIntelligence, type IntelligenceResult } from "./intelligence/index.ts";
import type { Manifest } from "./ingest.ts";
import type { AutonomousReport, Verdict } from "./report.ts";
import type { HarnessResult } from "./rust-harness.ts";
import type { Selection } from "./select.ts";
import { createSyntheticTarget } from "./synthetic.ts";

export const ENGINE_VERSION = "shakuni-autonomous-0.1";

export interface RunInput {
  repository: string;
  maxSeverity: string | null;
  inScope: boolean;
  scopeNote: string | null;
  bountyEligible: boolean | null;
  githubRecords: GitHubRecord[];
  analyses: ExternalAnalysis[];
  /** Replays for the capability proof (user asked for 5). */
  replays?: number;
  /** How the target was chosen autonomously, if it was. */
  selection?: Selection;
  /** The cloned, commit-pinned, scope-filtered local copy, if ingestion ran. */
  manifest?: Manifest;
  /** Real harnesses that executed against the cloned code. */
  harnessResults?: HarnessResult[];
}

function verdictFromGate(intel: IntelligenceResult | undefined): Verdict {
  if (!intel) {
    return { submit: false, label: "DO NOT SUBMIT, no evidence gathered yet.", reasons: ["No harness has executed against the real code."] };
  }
  const { gate } = intel;
  const submit = gate.verdict === "SUBMIT_RECOMMENDED";
  const reasons = [gate.reason];
  if (gate.missingGates.length) reasons.push(`Missing evidence gates: ${gate.missingGates.join(", ")}.`);
  reasons.push(...intel.intelligence.nextExperiments.slice(0, 3));
  return { submit, label: `${gate.verdict}, ${gate.reason}`, reasons };
}

export function runAutonomous(input: RunInput): AutonomousReport {
  const replays = input.replays ?? 5;
  const finding = hunt(createSyntheticTarget(), { synthetic: true, replays, maxDepth: 16, beamWidth: 256, budget: 5_000_000 });
  const analysis = input.analyses.find((a) => a.repository.toLowerCase() === input.repository.toLowerCase());
  const rawHypotheses = hypothesesFor(input.repository);
  const hypotheses = crossCheck(rawHypotheses, input.repository, input.githubRecords, analysis, input.maxSeverity, input.manifest?.topDirs);
  const executed = input.harnessResults ?? [];
  const generation = annotatePlan(planHarnesses(hypotheses), executed);
  const broken = executed.find((h) => h.result === "BROKEN");
  const draftReport = broken ? draftSubmission(broken, input.repository, input.maxSeverity, input.manifest) : undefined;
  const withHarness = hypotheses
    .map((h) => ({ h, res: executed.find((e) => e.property === harnessForLead(h.id)?.property) }))
    .filter((x) => x.res);
  const topHyp = (withHarness.find((x) => x.res!.result === "BROKEN") ?? withHarness[0])?.h ?? hypotheses[0];
  const recCountEarly = input.githubRecords.filter((r) => r.repository.toLowerCase() === input.repository.toLowerCase()).length;
  const intelligence: IntelligenceResult | undefined = topHyp ? runIntelligence({
    repository: input.repository,
    commit: input.manifest?.commit ?? "unpinned",
    scopeNote: input.scopeNote,
    authorization: input.inScope ? "Arc Bug Bounty Program, in-scope source, local analysis only (no mainnet, no funds, no third-party data)." : "",
    inScope: input.inScope,
    hypothesis: topHyp,
    executed,
    surface: { entryPoints: analysis?.summary.entryPoints, languages: analysis?.summary.languages },
    manifest: input.manifest,
    historyChecked: recCountEarly > 0,
  }) : undefined;
  const verdict = verdictFromGate(intelligence);
  const prCount = input.githubRecords.filter((r) => r.repository.toLowerCase() === input.repository.toLowerCase() && r.type === "pull_request").length;
  const recCount = input.githubRecords.filter((r) => r.repository.toLowerCase() === input.repository.toLowerCase()).length;
  const ran = executed.filter((h) => h.result !== "ERROR").length;
  const limitations: string[] = [
    ran > 0
      ? `${ran} real Rust harness${ran > 1 ? "es" : ""} executed against the cloned code. A HELD result is evidence the property holds for the searched space, not a proof of total safety; leads without a harness remain UNTESTED.`
      : "No harness executed this run, so every lead below is an UNTESTED hypothesis, not a reproduction.",
    "Hypotheses are drawn from each system's documented purpose and a security taxonomy; a lead without a passing/failing harness is a review agenda item, not evidence of a defect.",
    "Cross-references report only what is in the imported PRs and ArchSetu data; absence of a match does not mean absence of risk.",
  ];
  if (!isKnownTarget(input.repository)) limitations.unshift(`No hypothesis catalog exists for ${input.repository}; only the capability proof and imported-data summary are shown.`);
  if (!analysis) limitations.push(`ArchSetu analysis for ${input.repository} was not imported, so the attack-surface section is sparse.`);
  if (recCount === 0) limitations.push(`No GitHub records for ${input.repository} were imported, so PR cross-checks could not run.`);
  return {
    generatedAt: new Date().toISOString(), engineVersion: ENGINE_VERSION,
    selection: input.selection ? { reasons: input.selection.ranking[0].reasons, ranking: input.selection.ranking.map((x) => ({ repository: x.repository, score: x.score })) } : undefined,
    ingestion: input.manifest,
    target: { repository: input.repository, maxSeverity: input.maxSeverity, inScope: input.inScope, scopeNote: input.scopeNote, bountyEligible: input.bountyEligible },
    capabilityProof: { finding, replaysRun: replays, note: "This proves the proving pipeline is real. The SAME pipeline will validate a real-repo hypothesis once an executable model or harness for that repo exists, that bridge is the next build." },
    surface: {
      archsetu: analysis ? { present: true, files: analysis.summary.files, functions: analysis.summary.functions, deadCode: analysis.summary.deadCode, entryPoints: analysis.summary.entryPoints, languages: analysis.summary.languages } : { present: false },
      github: { present: recCount > 0, records: recCount, pullRequests: prCount },
    },
    executed, generation, draftReport, intelligence, verdict, hypotheses, limitations, humanReviewRequired: true,
  };
}

// ============================================================================

// ADDITIONAL SHAKUNI RESEARCH MEMORY

// ============================================================================

// IMPORTANT:

// - Everything above this section is the ORIGINAL run.ts implementation.

// - Nothing above has been changed.

// - These additions do NOT control the deterministic gate.

// - These additions do NOT change verdictFromGate().

// - These additions do NOT promote a real finding to GREEN.

// - Memory only helps Shakuni remember previous research and choose better

//   future experiments.

// ============================================================================



/**

 * Persistent-style research memory represented in memory for the current

 * process.

 *

 * This intentionally does not modify runAutonomous().

 *

 * Later this can be backed by:

 * - JSON

 * - SQLite

 * - PostgreSQL/Supabase

 * - another durable store

 *

 * without changing the existing autonomous pipeline.

 */

export interface ShakuniResearchMemory {

  repository: string;

  commit: string;



  runs: number;



  firstSeenAt: string;

  lastSeenAt: string;



  hypothesesSeen: string[];

  hypothesesTested: string[];

  hypothesesBroken: string[];

  hypothesesHeld: string[];

  hypothesesErrored: string[];



  propertiesTested: string[];



  replayHistory: ShakuniReplayMemory[];



  harnessHistory: ShakuniHarnessMemory[];



  evidenceHistory: ShakuniEvidenceMemory[];



  disproofHistory: ShakuniDisproofMemory[];



  failedAssumptions: string[];



  alternateExperiments: string[];



  uncoveredSurfaces: string[];



  knownLimitations: string[];



  learnedRules: ShakuniLearnedRule[];

}



export interface ShakuniReplayMemory {

  hypothesisId: string;

  property: string;



  result: "BROKEN" | "HELD" | "ERROR" | "UNKNOWN";



  replayCount: number;



  timestamp: string;

}



export interface ShakuniHarnessMemory {

  property: string;



  result: string;



  harnessAvailable: boolean;



  timestamp: string;

}



export interface ShakuniEvidenceMemory {

  type:

    | "CAPABILITY_PROOF"

    | "HARNESS"

    | "REPLAY"

    | "ARCHSETU"

    | "GITHUB"

    | "MANIFEST"

    | "INTELLIGENCE"

    | "GATE";



  description: string;



  repository: string;



  commit: string;



  timestamp: string;

}



export interface ShakuniDisproofMemory {

  hypothesisId: string;



  property: string;



  reason: string;



  evidence: string[];



  timestamp: string;

}



export interface ShakuniLearnedRule {

  rule: string;



  sourceCount: number;



  confidence:

    | "LOW"

    | "MEDIUM"

    | "HIGH";



  timestamp: string;

}



/**

 * In-process memory.

 *

 * IMPORTANT:

 * This memory never decides whether something is a vulnerability.

 *

 * It only remembers research history.

 */

const SHAKUNI_RESEARCH_MEMORY =

    new Map<string, ShakuniResearchMemory>();



/**

 * Normalize repository names so:

 *

 * CircleFin/Arc-Node

 *

 * and

 *

 * circlefin/arc-node

 *

 * use the same memory bucket.

 */

function normalizeMemoryRepository(

  repository: string,

): string {

  return repository

    .trim()

    .toLowerCase()

    .replace(/\/+$/, "");

}



/**

 * Create a fresh memory record.

 *

 * ADDITION ONLY.

 */

function createResearchMemory(

  repository: string,

  commit: string,

): ShakuniResearchMemory {

  const now =

    new Date().toISOString();



  return {

    repository,

    commit,



    runs: 0,



    firstSeenAt: now,

    lastSeenAt: now,



    hypothesesSeen: [],

    hypothesesTested: [],

    hypothesesBroken: [],

    hypothesesHeld: [],

    hypothesesErrored: [],



    propertiesTested: [],



    replayHistory: [],



    harnessHistory: [],



    evidenceHistory: [],



    disproofHistory: [],



    failedAssumptions: [],



    alternateExperiments: [],



    uncoveredSurfaces: [],



    knownLimitations: [],



    learnedRules: [],

  };

}



/**

 * Get existing research memory or create it.

 *

 * This is deliberately independent of runAutonomous().

 */

export function getShakuniResearchMemory(

  repository: string,

  commit = "unpinned",

): ShakuniResearchMemory {

  const key =

    normalizeMemoryRepository(repository);



  let memory =

    SHAKUNI_RESEARCH_MEMORY.get(key);



  if (!memory) {

    memory = createResearchMemory(

      repository,

      commit,

    );



    SHAKUNI_RESEARCH_MEMORY.set(

      key,

      memory,

    );

  }



  return memory;

}



/**

 * Add a value to an array only when it does not already exist.

 *

 * Prevents the memory from filling with duplicate information.

 */

function rememberUnique(

  values: string[],

  value: string,

): void {

  const normalized =

    value.trim();



  if (!normalized) {

    return;

  }



  if (!values.includes(normalized)) {

    values.push(normalized);

  }

}



/**

 * Learn from the CURRENT AutonomousReport.

 *

 * IMPORTANT:

 * This does not modify the report.

 * It creates/updates research memory separately.

 */

export function rememberAutonomousRun(

  report: AutonomousReport,

): ShakuniResearchMemory {

  const repository =

    normalizeMemoryRepository(

      report.target.repository,

    );



  const commit =

    report.ingestion?.commit ??

    "unpinned";



  const memory =

    getShakuniResearchMemory(

      repository,

      commit,

    );



  const now =

    new Date().toISOString();



  memory.runs += 1;

  memory.lastSeenAt = now;

  memory.commit = commit;



  // --------------------------------------------------------------------------

  // REMEMBER HYPOTHESES

  // --------------------------------------------------------------------------



  for (const hypothesis of report.hypotheses) {

    rememberUnique(

      memory.hypothesesSeen,

      hypothesis.id,

    );

  }



  // --------------------------------------------------------------------------

  // REMEMBER REAL HARNESS EXECUTIONS

  // --------------------------------------------------------------------------



  for (const harness of report.executed) {

    rememberUnique(

      memory.hypothesesTested,

      harness.property,

    );



    rememberUnique(

      memory.propertiesTested,

      harness.property,

    );



    const result =

      harness.result === "BROKEN"

        ? "BROKEN"

        : harness.result === "HELD"

          ? "HELD"

          : harness.result === "ERROR"

            ? "ERROR"

            : "UNKNOWN";



    if (result === "BROKEN") {

      rememberUnique(

        memory.hypothesesBroken,

        harness.property,

      );

    }



    if (result === "HELD") {

      rememberUnique(

        memory.hypothesesHeld,

        harness.property,

      );

    }



    if (result === "ERROR") {

      rememberUnique(

        memory.hypothesesErrored,

        harness.property,

      );

    }



    memory.harnessHistory.push({

      property:

        harness.property,



      result:

        harness.result,



      harnessAvailable:

        true,



      timestamp: now,

    });

  }



  // --------------------------------------------------------------------------

  // REMEMBER REPLAY INFORMATION

  // --------------------------------------------------------------------------



  for (const harness of report.executed) {

    memory.replayHistory.push({

      hypothesisId:

        harness.property,



      property:

        harness.property,



      result:

        harness.result === "BROKEN"

          ? "BROKEN"

          : harness.result === "HELD"

            ? "HELD"

            : harness.result === "ERROR"

              ? "ERROR"

              : "UNKNOWN",



      replayCount:

        report.capabilityProof.replaysRun,



      timestamp: now,

    });

  }



  // --------------------------------------------------------------------------

  // REMEMBER CAPABILITY-PROOF EVIDENCE

  // --------------------------------------------------------------------------



  memory.evidenceHistory.push({

    type:

      "CAPABILITY_PROOF",



    description:

      `Synthetic capability proof executed with ${report.capabilityProof.replaysRun} replay(s).`,



    repository,



    commit,



    timestamp: now,

  });



  // --------------------------------------------------------------------------

  // REMEMBER MANIFEST EVIDENCE

  // --------------------------------------------------------------------------



  if (report.ingestion) {

    memory.evidenceHistory.push({

      type:

        "MANIFEST",



      description:

        `Commit-pinned ingestion manifest available: ${report.ingestion.commit}`,



      repository,



      commit,



      timestamp: now,

    });

  }



  // --------------------------------------------------------------------------

  // REMEMBER ARCHSETU EVIDENCE

  // --------------------------------------------------------------------------



  if (report.surface.archsetu.present) {

    memory.evidenceHistory.push({

      type:

        "ARCHSETU",



      description:

        `ArchSetu analysis imported for ${repository}.`,



      repository,



      commit,



      timestamp: now,

    });

  }



  // --------------------------------------------------------------------------

  // REMEMBER GITHUB EVIDENCE

  // --------------------------------------------------------------------------



  if (report.surface.github.present) {

    memory.evidenceHistory.push({

      type:

        "GITHUB",



      description:

        `${report.surface.github.records} GitHub record(s) imported, including ${report.surface.github.pullRequests} pull request(s).`,



      repository,



      commit,



      timestamp: now,

    });

  }



  // --------------------------------------------------------------------------

  // REMEMBER INTELLIGENCE OUTPUT

  // --------------------------------------------------------------------------



  if (report.intelligence) {

    memory.evidenceHistory.push({

      type:

        "INTELLIGENCE",



      description:

        "Intelligence analysis executed before deterministic gate adjudication.",



      repository,



      commit,



      timestamp: now,

    });



    for (

      const experiment

      of report.intelligence.intelligence

        .nextExperiments

    ) {

      rememberUnique(

        memory.alternateExperiments,

        experiment,

      );

    }



    for (

      const missing

      of report.intelligence.gate

        .missingGates

    ) {

      rememberUnique(

        memory.uncoveredSurfaces,

        missing,

      );

    }

  }



  // --------------------------------------------------------------------------

  // REMEMBER FINAL GATE INFORMATION

  // --------------------------------------------------------------------------



  if (report.intelligence) {

    memory.evidenceHistory.push({

      type:

        "GATE",



      description:

        `Deterministic gate returned ${report.intelligence.gate.verdict}.`,



      repository,



      commit,



      timestamp: now,

    });



    for (

      const missing

      of report.intelligence.gate

        .missingGates

    ) {

      rememberUnique(

        memory.knownLimitations,

        missing,

      );

    }

  }



  // --------------------------------------------------------------------------

  // REMEMBER REPORT LIMITATIONS

  // --------------------------------------------------------------------------



  for (

    const limitation

    of report.limitations

  ) {

    rememberUnique(

      memory.knownLimitations,

      limitation,

    );

  }



  // --------------------------------------------------------------------------

  // LEARN BASIC RESEARCH RULES

  // --------------------------------------------------------------------------



  learnResearchRules(memory);



  return memory;

}



/**

 * Convert repeated research observations into reusable rules.

 *

 * These rules affect future investigation planning only.

 *

 * They NEVER override gate.ts.

 */

function learnResearchRules(

  memory: ShakuniResearchMemory,

): void {

  // --------------------------------------------------------------------------

  // RULE 1, repeated HELD properties

  // --------------------------------------------------------------------------



  if (

    memory.hypothesesHeld.length >= 3

  ) {

    upsertLearnedRule(

      memory,

      "Previously tested properties that repeatedly HELD should not be treated as confirmed vulnerabilities; search alternate state transitions or entry paths.",

      memory.hypothesesHeld.length,

    );

  }



  // --------------------------------------------------------------------------

  // RULE 2, repeated BROKEN properties

  // --------------------------------------------------------------------------



  if (

    memory.hypothesesBroken.length > 0

  ) {

    upsertLearnedRule(

      memory,

      "A BROKEN harness result is evidence requiring complete causal, replay, and impact validation; memory alone cannot promote it.",

      memory.hypothesesBroken.length,

    );

  }



  // --------------------------------------------------------------------------

  // RULE 3, missing harnesses

  // --------------------------------------------------------------------------



  if (

    memory.hypothesesSeen.length >

    memory.hypothesesTested.length

  ) {

    upsertLearnedRule(

      memory,

      "Untested hypotheses remain research leads and require executable harness coverage before they can produce reproduction evidence.",

      memory.hypothesesSeen.length -

        memory.hypothesesTested.length,

    );

  }



  // --------------------------------------------------------------------------

  // RULE 4, errors

  // --------------------------------------------------------------------------



  if (

    memory.hypothesesErrored.length > 0

  ) {

    upsertLearnedRule(

      memory,

      "Harness execution errors must be resolved or explicitly classified before the affected property is considered tested.",

      memory.hypothesesErrored.length,

    );

  }

}



/**

 * Add or update a learned rule.

 */

function upsertLearnedRule(

  memory: ShakuniResearchMemory,

  rule: string,

  sourceCount: number,

): void {

  const existing =

    memory.learnedRules.find(

      (x) => x.rule === rule,

    );



  const confidence =

    sourceCount >= 5

      ? "HIGH"

      : sourceCount >= 2

        ? "MEDIUM"

        : "LOW";



  if (existing) {

    existing.sourceCount =

      sourceCount;



    existing.confidence =

      confidence;



    existing.timestamp =

      new Date().toISOString();



    return;

  }



  memory.learnedRules.push({

    rule,



    sourceCount,



    confidence,



    timestamp:

      new Date().toISOString(),

  });

}



/**

 * Ask memory whether a property has already been investigated.

 *

 * This DOES NOT say whether the property is vulnerable.

 */

export function propertyResearchHistory(

  repository: string,

  property: string,

): {

  seen: boolean;

  tested: boolean;

  broken: boolean;

  held: boolean;

  errors: boolean;

  attempts: number;

} {

  const memory =

    SHAKUNI_RESEARCH_MEMORY.get(

      normalizeMemoryRepository(

        repository,

      ),

    );



  if (!memory) {

    return {

      seen: false,

      tested: false,

      broken: false,

      held: false,

      errors: false,

      attempts: 0,

    };

  }



  const attempts =

    memory.replayHistory.filter(

      (x) =>

        x.property === property,

    ).length;



  return {

    seen:

      memory.hypothesesSeen.includes(

        property,

      ) ||

      memory.propertiesTested.includes(

        property,

      ),



    tested:

      memory.propertiesTested.includes(

        property,

      ),



    broken:

      memory.hypothesesBroken.includes(

        property,

      ),



    held:

      memory.hypothesesHeld.includes(

        property,

      ),



    errors:

      memory.hypothesesErrored.includes(

        property,

      ),



    attempts,

  };

}



/**

 * Return the research priorities remembered by Shakuni.

 *

 * This is deliberately descriptive rather than authoritative.

 */

export function getResearchPriorities(

  repository: string,

): string[] {

  const memory =

    SHAKUNI_RESEARCH_MEMORY.get(

      normalizeMemoryRepository(

        repository,

      ),

    );



  if (!memory) {

    return [

      "No historical research memory exists for this repository.",

      "Begin with surface discovery and executable hypothesis construction.",

    ];

  }



  const priorities: string[] = [];



  if (

    memory.hypothesesBroken.length

  ) {

    priorities.push(

      "Revalidate BROKEN properties with independent causal and replay evidence.",

    );

  }



  if (

    memory.hypothesesErrored.length

  ) {

    priorities.push(

      "Resolve harness execution errors before treating affected properties as tested.",

    );

  }



  if (

    memory.hypothesesSeen.length >

    memory.hypothesesTested.length

  ) {

    priorities.push(

      "Build harness coverage for previously discovered but untested hypotheses.",

    );

  }



  for (

    const experiment

    of memory.alternateExperiments.slice(

      0,

      5,

    )

  ) {

    priorities.push(

      `Previously suggested experiment: ${experiment}`,

    );

  }



  if (!priorities.length) {

    priorities.push(

      "Continue expanding executable coverage while preserving deterministic gate requirements.",

    );

  }



  return priorities;

}



/**

 * Export a safe snapshot of memory.

 *

 * The returned object is copied so callers cannot accidentally mutate the

 * internal memory directly.

 */

export function snapshotShakuniMemory(

  repository: string,

): ShakuniResearchMemory | undefined {

  const memory =

    SHAKUNI_RESEARCH_MEMORY.get(

      normalizeMemoryRepository(

        repository,

      ),

    );



  if (!memory) {

    return undefined;

  }



  return structuredClone(memory);

}



/**

 * Clear research memory for one repository.

 *

 * This is intentionally explicit and repository-scoped.

 */

export function clearShakuniMemory(

  repository: string,

): boolean {

  return SHAKUNI_RESEARCH_MEMORY.delete(

    normalizeMemoryRepository(

      repository,

    ),

  );

}