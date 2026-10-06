import type { ExternalAnalysis } from "../external-analysis/types.ts";
import type { GitHubRecord } from "../github/types.ts";
import { crossCheck } from "./crosscheck.ts";
import { hypothesesFor } from "./hypotheses.ts";
import { SCOPE_TARGETS, type ScopeEntry } from "./scope.ts";

/**
 * Autonomous target selection. The product scores every in-scope target from
 * the evidence actually imported and picks the one worth hunting first, no
 * human choice required. Deterministic and explainable.
 */
export interface TargetScore {
  repository: string;
  score: number;
  reasons: string[];
}

export interface Selection {
  selected: ScopeEntry;
  ranking: TargetScore[];
}

const sevWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function selectTarget(githubRecords: GitHubRecord[], analyses: ExternalAnalysis[]): Selection {
  const ranking: TargetScore[] = SCOPE_TARGETS.map((t) => {
    const reasons: string[] = [];
    let score = 0;

    const sev = sevWeight[(t.maxSeverity ?? "").toLowerCase()] ?? 0;
    score += sev * 10;
    reasons.push(`severity ceiling ${t.maxSeverity} (+${sev * 10})`);

    const analysis = analyses.find((a) => a.repository.toLowerCase() === t.repository.toLowerCase());
    if (analysis) {
      score += 8;
      const ep = analysis.summary.entryPoints ?? 0;
      score += Math.min(ep, 20);
      reasons.push(`ArchSetu imported, ${ep} entry points (+${8 + Math.min(ep, 20)})`);
    } else {
      reasons.push("no ArchSetu imported (+0)");
    }

    const recs = githubRecords.filter((r) => r.repository.toLowerCase() === t.repository.toLowerCase());
    const prs = recs.filter((r) => r.type === "pull_request").length;
    score += Math.min(prs, 30);
    reasons.push(`${prs} PRs imported (+${Math.min(prs, 30)})`);

    // Reward targets where hypotheses actually cross-link to imported evidence.
    const crossed = crossCheck(hypothesesFor(t.repository), t.repository, githubRecords, analysis, t.maxSeverity);
    const linkedLeads = crossed.filter((h) => h.crossRefs.some((c) => c.source === "github-pr")).length;
    score += linkedLeads * 4;
    if (linkedLeads) reasons.push(`${linkedLeads} leads cross-link to imported PRs (+${linkedLeads * 4})`);

    return { repository: t.repository, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const selected = SCOPE_TARGETS.find((t) => t.repository === ranking[0].repository)!;
  return { selected, ranking };
}
