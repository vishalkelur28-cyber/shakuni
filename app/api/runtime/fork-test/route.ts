import { NextResponse } from "next/server";
import { runForkInvariant, type ForkTestRequest } from "../../../../lib/runtime/forge-adapter";

/**
 * POST /api/runtime/fork-test
 *
 * Runs a real forge invariant test against a forked Arc contract on the
 * researcher's machine and returns an ExecutedExperiment. Server-only; spawns
 * `forge`. Mainnet fork targets are hard-blocked in the adapter.
 *
 * This route only exists when Shakuni runs locally (next dev / next start on
 * your own machine). It is not meant to be deployed to a public host.
 */
export async function POST(request: Request) {
  let body: Partial<ForkTestRequest> & { planId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { planId, projectDir, testContract, invariantFn, forkRpcUrl, forkBlock, chainId } = body;

  if (typeof planId !== "string" || !planId) {
    return NextResponse.json({ error: "planId is required." }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ projectDir, testContract, invariantFn, forkRpcUrl })) {
    if (typeof v !== "string" || !v) {
      return NextResponse.json({ error: `${k} is required and must be a non-empty string.` }, { status: 400 });
    }
  }
  if (typeof forkBlock !== "number" || !Number.isInteger(forkBlock) || forkBlock <= 0) {
    return NextResponse.json({ error: "forkBlock must be a positive integer (pin a block for reproducibility)." }, { status: 400 });
  }
  if (typeof chainId !== "number") {
    return NextResponse.json({ error: "chainId is required (Arc testnet = 5042002)." }, { status: 400 });
  }

  try {
    const { experiment, reason } = await runForkInvariant(planId, {
      projectDir: projectDir as string,
      testContract: testContract as string,
      invariantFn: invariantFn as string,
      forkRpcUrl: forkRpcUrl as string,
      forkBlock,
      chainId,
      negativeControlFn: typeof body.negativeControlFn === "string" ? body.negativeControlFn : undefined,
      timeoutSec: typeof body.timeoutSec === "number" ? body.timeoutSec : undefined,
      forgeBin: typeof body.forgeBin === "string" ? body.forgeBin : undefined,
    });
    return NextResponse.json({ experiment, reason });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fork test failed to run." },
      { status: 500 },
    );
  }
}
