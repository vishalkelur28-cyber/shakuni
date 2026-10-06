import type { ExternalAnalysis } from "../external-analysis/types.ts";
import type { GitHubRecord } from "../github/types.ts";
import type { CrossRef, RepoHypothesis } from "./report.ts";

/**
 * Cross-reference each hypothesis against the user's IMPORTED data only
 * (GitHub PRs/records + ArchSetu analysis). Pure functions over data already
 * in the workspace, no network. Everything produced here is labeled
 * "observed" (it is a fact about imported data), never a vulnerability claim.
 */

function matchArea(text: string, area: string[]): string[] {
  const lower = text.toLowerCase();
  return area.filter((kw) => lower.includes(kw.toLowerCase()));
}

function prCrossRefs(records: GitHubRecord[], repo: string, area: string[]): CrossRef[] {
  const refs: CrossRef[] = [];
  for (const r of records) {
    if (r.repository.toLowerCase() !== repo.toLowerCase()) continue;
    const haystack = [r.title, r.body, ...(r.filesChanged ?? []), ...(r.comments ?? [])].filter(Boolean).join(" ");
    const hits = matchArea(haystack, area);
    if (!hits.length) continue;
    const fixish = /\b(fix|patch|resolve|vuln|security|audit|harden|mitigat)\b/i.test(`${r.title ?? ""} ${r.body ?? ""}`);
    refs.push({
      source: "github-pr",
      label: `${r.type.replace("_", " ")} #${r.number ?? r.id}${r.merged ? " (merged)" : ""}: ${r.title?.slice(0, 80) ?? "(no title)"}`,
      detail: `matches ${hits.join(", ")}${fixish ? ", mentions a fix/security change, so this area may already be addressed; check whether the issue predates it" : ""}`,
      url: r.sourceUrl,
      signal: fixish && r.merged ? "possibly-fixed" : "recently-touched",
    });
    if (refs.length >= 4) break; // keep the report readable
  }
  return refs;
}

function archsetuCrossRefs(analysis: ExternalAnalysis | undefined): CrossRef[] {
  if (!analysis) return [];
  const s = analysis.summary;
  const refs: CrossRef[] = [];
  if (typeof s.entryPoints === "number") {
    refs.push({ source: "archsetu", label: `${s.entryPoints} entry points`, detail: "attacker-reachable entry points to prioritise when building the executable model", signal: "attack-surface" });
  }
  if (typeof s.deadCode === "number" && s.deadCode > 0) {
    refs.push({ source: "archsetu", label: `${s.deadCode} dead-code candidates`, detail: "reachability is uncertain; de-prioritise unless an entry point reaches it", signal: "context" });
  }
  return refs;
}

/** Point a hypothesis at the real cloned in-scope directories whose names match its area. */
function repoPathCrossRefs(dirs: { dir: string; files: number }[] | undefined, area: string[]): CrossRef[] {
  if (!dirs?.length) return [];
  const refs: CrossRef[] = [];
  for (const d of dirs) {
    const hits = matchArea(d.dir, area);
    if (hits.length) refs.push({ source: "repo-path", label: `${d.dir} (${d.files} files)`, detail: `in-scope code matching ${hits.join(", ")}, start the model/harness here`, signal: "in-scope-code" });
    if (refs.length >= 3) break;
  }
  return refs;
}

/** Attach cross-refs and compute a priority rank for each hypothesis. */
export function crossCheck(
  hypotheses: RepoHypothesis[],
  repo: string,
  records: GitHubRecord[],
  analysis: ExternalAnalysis | undefined,
  maxSeverity: string | null,
  inScopeDirs?: { dir: string; files: number }[],
): RepoHypothesis[] {
  const sevWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const base = sevWeight[(maxSeverity ?? "").toLowerCase()] ?? 2;
  const archRefs = archsetuCrossRefs(analysis);

  const scored = hypotheses.map((h) => {
    const prs = prCrossRefs(records, repo, h.area);
    const paths = repoPathCrossRefs(inScopeDirs, h.area);
    const crossRefs = [...paths, ...prs, ...archRefs];
    const touched = prs.filter((r) => r.signal === "recently-touched").length;
    const fixedCount = prs.filter((r) => r.signal === "possibly-fixed").length;
    // Any PR linkage is signal that this area is real and active, so it ranks
    // above unlinked leads. Recently-touched weighs most; a merged security fix
    // still raises priority (active, security-relevant) but flips status to
    // PLAUSIBLE so the reviewer checks whether the issue predates the fix.
    // A match to real in-scope code also raises priority (concretely reachable).
    const priority = base * 10 + touched * 3 + fixedCount * 2 + paths.length * 2;
    const status: RepoHypothesis["status"] = fixedCount > 0 ? "PLAUSIBLE" : h.status;
    return { ...h, crossRefs, priority, status };
  });
  return scored.sort((a, b) => b.priority - a.priority);
}
