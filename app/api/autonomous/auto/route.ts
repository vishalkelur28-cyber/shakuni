import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../../lib/security/local-only.ts";
import { ingestTarget } from "../../../../lib/autonomous/ingest.ts";
import { renderReportMarkdown } from "../../../../lib/autonomous/report.ts";
import { runAutonomous } from "../../../../lib/autonomous/run.ts";
import { runHarnessesForRepo, type HarnessResult } from "../../../../lib/autonomous/rust-harness.ts";
import { scopeFor } from "../../../../lib/autonomous/scope.ts";
import { selectTarget } from "../../../../lib/autonomous/select.ts";
import type { ExternalAnalysis } from "../../../../lib/external-analysis/types.ts";
import type { GitHubRecord } from "../../../../lib/github/types.ts";

/**
 * POST /api/autonomous/auto, local-only, nodejs.
 * The product does it all: select an in-scope target from imported evidence,
 * clone it into local dev (commit-pinned, scope-filtered), run the engine, and
 * return the research dossier. Cloning touches the network (git clone of an
 * authorized public repo); everything else is local.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let body: { githubRecords?: unknown; analyses?: unknown; repository?: unknown; runHarness?: boolean; harnessIters?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const githubRecords = Array.isArray(body.githubRecords) ? (body.githubRecords as GitHubRecord[]) : [];
  const analyses = Array.isArray(body.analyses) ? (body.analyses as ExternalAnalysis[]) : [];

  // Let the product choose, unless the caller pinned a specific in-scope repo.
  const selection = selectTarget(githubRecords, analyses);
  const pinned = typeof body.repository === "string" ? scopeFor(body.repository) : null;
  const scope = pinned ?? selection.selected;

  try {
    const manifest = await ingestTarget(scope.repository).catch((e) => {
      throw new Error(`Ingestion (git clone) failed for ${scope.repository}: ${e instanceof Error ? e.message : "unknown"}. Is git on PATH and the network reachable?`);
    });
    // Real execution: if the target has an executable harness, run it as part of
    // the one flow (not a separate step). Best-effort, a missing toolchain or a
    // long compile just means no executed evidence this run, not a failed hunt.
    const harnessResults: HarnessResult[] = [];
    if (body.runHarness !== false) {
      const iters = typeof body.harnessIters === "number" ? body.harnessIters : 30_000;
      try { harnessResults.push(...await runHarnessesForRepo(scope.repository, iters)); } catch { /* no executed evidence this run */ }
    }

    const report = runAutonomous({
      repository: scope.repository,
      maxSeverity: scope.maxSeverity,
      inScope: scope.inScope,
      scopeNote: scope.scopeNote,
      bountyEligible: scope.bountyEligible,
      githubRecords,
      analyses,
      replays: 5,
      selection: pinned ? undefined : selection,
      manifest,
      harnessResults,
    });
    return NextResponse.json({ selection, manifest, report, markdown: renderReportMarkdown(report) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auto run failed." }, { status: 500 });
  }
}
