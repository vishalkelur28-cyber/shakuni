import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../../lib/security/local-only.ts";
import { HarnessError, runMalachiteQuorumHarness } from "../../../../lib/autonomous/rust-harness.ts";

/**
 * POST /api/autonomous/harness, local-only, nodejs.
 * Runs the real Rust property harness against malachite's cloned code.
 * Body: { iters?: number }. Executes `cargo test`; can take a while.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let body: { iters?: unknown };
  try { body = await request.json(); } catch { body = {}; }
  const iters = typeof body.iters === "number" && body.iters > 0 ? Math.min(Math.floor(body.iters), 2_000_000) : 50_000;

  try {
    const result = await runMalachiteQuorumHarness(iters);
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof HarnessError ? e.message : e instanceof Error ? e.message : "Harness failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
