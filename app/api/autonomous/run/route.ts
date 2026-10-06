import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../../lib/security/local-only.ts";
import { runAutonomous } from "../../../../lib/autonomous/run.ts";
import { renderReportMarkdown } from "../../../../lib/autonomous/report.ts";
import { scopeFor } from "../../../../lib/autonomous/scope.ts";
import type { GitHubRecord } from "../../../../lib/github/types.ts";
import type { ExternalAnalysis } from "../../../../lib/external-analysis/types.ts";

/**
 * POST /api/autonomous/run, local-only.
 * Body: { repository, githubRecords?, analyses? } (the imported workspace data).
 * Picks the target, runs the engine, returns the structured report + markdown.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let body: { repository?: unknown; githubRecords?: unknown; analyses?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const repository = typeof body.repository === "string" ? body.repository : "";
  const scope = scopeFor(repository);
  if (!scope) return NextResponse.json({ error: `"${repository}" is not one of the in-scope targets. Allowed: circlefin/malachite, circlefin/arc-node, circlefin/arc-remote-signer.` }, { status: 400 });

  const githubRecords = Array.isArray(body.githubRecords) ? (body.githubRecords as GitHubRecord[]) : [];
  const analyses = Array.isArray(body.analyses) ? (body.analyses as ExternalAnalysis[]) : [];

  try {
    const report = runAutonomous({
      repository: scope.repository,
      maxSeverity: scope.maxSeverity,
      inScope: scope.inScope,
      scopeNote: scope.scopeNote,
      bountyEligible: scope.bountyEligible,
      githubRecords,
      analyses,
      replays: 5,
    });
    return NextResponse.json({ report, markdown: renderReportMarkdown(report) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 500 });
  }
}
