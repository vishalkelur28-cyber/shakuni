import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecutedExperiment } from "../research/deep-loop";
import { spawnTarget } from "./arc-tools";

/**
 * Local runtime adapter.
 *
 * Runs REAL `forge` invariant tests against a forked Arc contract and returns
 * an ExecutedExperiment whose hashes come only from actual tool output. It
 * never fabricates a PASS/FAIL or a hash. If forge is missing or the run is
 * unusable, it returns outcome "blocked"/"inconclusive" with a reason, so the
 * confirmation gate in deep-loop can never be fooled.
 *
 * This file is server-only. It must run on the researcher's own machine where
 * Foundry (arc-forge / forge) and a local fork (arc-anvil) are installed.
 * Nothing here touches Arc mainnet. The caller is responsible for pointing the
 * fork at an authorized testnet RPC.
 */

export interface ForkTestRequest {
  /** Absolute path to the Foundry project that holds the invariant test. */
  projectDir: string;
  /** The forge invariant test contract name, e.g. "MintConservationInvariant". */
  testContract: string;
  /** The specific invariant function, e.g. "invariant_erc20BalanceEqualsNativeBalance". */
  invariantFn: string;
  /** Fork RPC URL. MUST be a local fork or authorized testnet, never mainnet. */
  forkRpcUrl: string;
  /** Block number pinned for reproducibility. Required: a fork with no pin is not reproducible. */
  forkBlock: number;
  /** Optional negative-control invariant fn expected to PASS on a known-safe path. */
  negativeControlFn?: string;
  /** Chain id of the fork, recorded as provenance. */
  chainId: number;
  /** Max seconds before the run is killed. */
  timeoutSec?: number;
  /** Forge binary to spawn. Defaults to "forge"; use "arc-forge" for Arc (stock forge can't run the 0x1800 precompile). */
  forgeBin?: string;
}

// Exact-hostname allowlist. We parse the URL and match the host, never a
// substring, so "https://evil.host/?x=rpc.testnet.arc.io" cannot slip through.
const ALLOWED_HOSTS = new Set([
  "rpc.testnet.arc.io",
  "127.0.0.1",
  "localhost",
  "0.0.0.0",
  "[::1]",
]);

/** Hard block: only allow an exact local or Arc-testnet host. Everything else is refused. */
function forkTargetAllowed(url: string): { ok: boolean; reason?: string } {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: `Fork URL "${url}" is not a valid URL. Blocked.` };
  }
  if (ALLOWED_HOSTS.has(host)) return { ok: true };
  return {
    ok: false,
    reason: `Fork host "${host}" is not an allowed local or Arc-testnet endpoint. Only ${[...ALLOWED_HOSTS].join(", ")} are permitted. Blocked for safety.`,
  };
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runForge(bin: string, args: string[], cwd: string, timeoutSec: number): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const target = spawnTarget(bin);
    const child = spawn(target.file, [...target.prefix, ...args], { cwd, env: process.env, windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutSec * 1000);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => {
      clearTimeout(timer);
      // forge not installed / not on PATH
      resolve({ code: null, stdout, stderr: `${stderr}\n[spawn-error] ${e.message}`, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Forge reports harness/setup problems with the same "[FAIL...]" prefix as a
// real invariant break. These markers mean the test never meaningfully ran.
const HARNESS_ERROR_MARKERS = [
  "failed to set up invariant testing environment",
  "no contracts to fuzz",
  "setup failed",
  "failed to set up",
  "evmerror",
  "stackunderflow",
  "[revert]",
  "execution reverted",
];

/**
 * Split forge output into per-test result blocks. Each block starts at a line
 * beginning with "[PASS]" or "[FAIL" and runs to the next such line (or the
 * suite summary). Recent forge prints a failing invariant over several lines:
 *
 *   [FAIL: <reason>]
 *       [Sequence] ...
 *    invariant_x() (runs: 1, calls: 1, reverts: 0)
 *
 * so the verdict and the function name are not on the same line.
 */
function resultBlocks(out: string): string[] {
  const lines = out.split("\n");
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (/^\[(PASS\]|FAIL)/.test(line)) {
      if (current) blocks.push(current.join("\n"));
      current = [line];
    } else if (current && /^(Suite result:|Ran \d+ test|Failing tests:|Traces:|Logs:)/.test(line.trim())) {
      blocks.push(current.join("\n"));
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current.join("\n"));
  return blocks;
}

/**
 * Parse a forge invariant run. Forge reports a failing invariant with a
 * counterexample sequence; a passing one reports "[PASS]". We only trust these
 * exact signals, and we return INCONCLUSIVE when we can't read a clear result
 * or when the "FAIL" is really a harness/setup error.
 */
function parseInvariantResult(fn: string, out: string): {
  result: ExecutedExperiment["invariantResult"];
  counterexample: string | null;
  harnessError?: string;
} {
  const fnCall = new RegExp(`(^|\\W)${escapeRe(fn)}\\(`);
  const blocks = resultBlocks(out);
  const block = blocks.find((b) => fnCall.test(b));

  if (!block) {
    // A reverted setUp() means the invariant never ran.
    if (blocks.some((b) => b.startsWith("[FAIL") && /setUp\(\)/.test(b))) {
      return { result: "INCONCLUSIVE", counterexample: null, harnessError: "setup failed" };
    }
    return { result: "INCONCLUSIVE", counterexample: null };
  }

  // Only the block header (verdict + reason, up to the function's result line) is
  // scanned for harness errors. With -vvvv, call traces legitimately contain
  // "← [Revert]" for handler calls that reverted, and scanning those would hide real breaks.
  const lines = block.split("\n");
  const fnLine = lines.findIndex((l) => fnCall.test(l));
  const header = lines.slice(0, fnLine + 1).join("\n");
  const marker = HARNESS_ERROR_MARKERS.find((m) => header.toLowerCase().includes(m));
  if (marker) return { result: "INCONCLUSIVE", counterexample: null, harnessError: marker };

  if (/\(runs: 0[,)]/.test(lines[fnLine])) {
    return { result: "INCONCLUSIVE", counterexample: null, harnessError: "zero fuzz runs" };
  }

  if (block.startsWith("[FAIL")) return { result: "FAIL", counterexample: block.slice(0, 4000) };
  if (block.startsWith("[PASS]")) return { result: "PASS", counterexample: null };
  return { result: "INCONCLUSIVE", counterexample: null };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Execute one invariant experiment against the fork and return real evidence.
 * The returned ExecutedExperiment is exactly what attachExperimentOutcome expects.
 */
export async function runForkInvariant(
  planId: string,
  req: ForkTestRequest,
): Promise<{ experiment: ExecutedExperiment; reason?: string }> {
  const startedAt = new Date().toISOString();
  const timeoutSec = req.timeoutSec ?? 300;

  const blocked = (reason: string): { experiment: ExecutedExperiment; reason: string } => ({
    reason,
    experiment: {
      planId,
      outcome: "blocked",
      startedAt,
      finishedAt: new Date().toISOString(),
      environment: "local",
      commitSha: "",
      traceHash: "",
      stateBeforeHash: "",
      stateAfterHash: "",
      invariantResult: "NOT_APPLICABLE",
      positiveControlPassed: false,
      negativeControlPassed: false,
      humanApproved: true, // local fork needs no testnet human approval
    },
  });

  // Safety gate first.
  const gate = forkTargetAllowed(req.forkRpcUrl);
  if (!gate.ok) return blocked(gate.reason!);
  if (!Number.isInteger(req.forkBlock) || req.forkBlock <= 0) {
    return blocked("A pinned fork block number is required for reproducibility.");
  }

  // A missing cwd makes spawn fail with ENOENT, which reads like "forge not installed".
  try {
    if (!(await stat(req.projectDir)).isDirectory()) return blocked(`Project path is not a folder: ${req.projectDir}`);
  } catch {
    return blocked(`Project path does not exist: ${req.projectDir}`);
  }

  // Primary invariant run against the fork.
  const args = [
    "test",
    "--match-contract", req.testContract,
    "--match-test", req.invariantFn,
    "--fork-url", req.forkRpcUrl,
    "--fork-block-number", String(req.forkBlock),
    "-vvvv",
  ];

  const bin = req.forgeBin?.trim() || "forge";
  const primary = await runForge(bin, args, req.projectDir, timeoutSec);

  if (primary.code === null && primary.stderr.includes("[spawn-error]")) {
    const detail = primary.stderr.split("[spawn-error]").pop()?.trim();
    return blocked(`Could not start "${bin}" (${detail || "unknown error"}). Check it is installed (arc-forge runs inside WSL on Windows) and that the project path exists. Stock forge can't run Arc's 0x1800 precompile.`);
  }
  if (primary.timedOut) {
    return blocked(`${bin} run exceeded ${timeoutSec}s and was killed. No usable result.`);
  }

  const combined = `${primary.stdout}\n${primary.stderr}`;
  const { result, counterexample, harnessError } = parseInvariantResult(req.invariantFn, combined);

  if (result === "INCONCLUSIVE") {
    const exp = blocked("Could not read a clear PASS/FAIL from forge output.").experiment;
    exp.outcome = "inconclusive";
    exp.invariantResult = "INCONCLUSIVE";
    exp.traceHash = sha256(combined);
    return {
      experiment: exp,
      reason: harnessError
        ? `Harness error, not an invariant verdict: "${harnessError}". Fix the test setup (or use arc-forge) and rerun.`
        : "forge output did not contain a recognizable invariant verdict.",
    };
  }

  // Negative control (optional but required for confirmation): a known-safe path
  // must keep the invariant satisfied. If it FAILS or doesn't run cleanly, the
  // test harness itself is suspect and the primary FAIL is not decisive.
  // Only a clean PASS sets negativeControlPassed.
  let negativeControlPassed = false;
  let ncReason = "Negative control not run (no negativeControlFn given).";
  if (req.negativeControlFn) {
    const ncArgs = [
      "test",
      "--match-contract", req.testContract,
      "--match-test", req.negativeControlFn,
      "--fork-url", req.forkRpcUrl,
      "--fork-block-number", String(req.forkBlock),
      "-vv",
    ];
    const nc = await runForge(bin, ncArgs, req.projectDir, timeoutSec);
    if (nc.code === null && nc.stderr.includes("[spawn-error]")) {
      ncReason = `Negative control failed to spawn "${bin}".`;
    } else if (nc.timedOut) {
      ncReason = `Negative control exceeded ${timeoutSec}s and was killed.`;
    } else {
      const ncParsed = parseInvariantResult(req.negativeControlFn, `${nc.stdout}\n${nc.stderr}`);
      negativeControlPassed = ncParsed.result === "PASS";
      ncReason = negativeControlPassed
        ? "Negative control PASSED."
        : ncParsed.harnessError
          ? `Negative control INCONCLUSIVE (harness error: "${ncParsed.harnessError}").`
          : `Negative control did not pass (result ${ncParsed.result}); the harness is suspect.`;
    }
  }

  // Provenance. Honest naming matters here:
  // - commitSha: a FORK FINGERPRINT (chainId+block+rpc), not a source commit.
  //   It is stable across reruns of the same fork, which is what we want for
  //   reproducibility of WHICH state was tested.
  // - traceHash: a hash of the raw forge output. It is NOT reproducible across
  //   runs (output carries timings and gas), so treat it as a run receipt /
  //   audit token, not as a value an independent reproduction must match.
  // - stateBeforeHash/stateAfterHash: these are NOT on-chain storage hashes.
  //   They fingerprint the fork identity and the counterexample. Capturing real
  //   pre/post storage needs cast calls on the touched slots (see TODO below).
  const forkIdentity = `fork:chainId=${req.chainId};block=${req.forkBlock};rpc=${req.forkRpcUrl}`;
  const traceHash = sha256(combined);
  const stateBeforeHash = sha256(`${forkIdentity};before`);
  const stateAfterHash = sha256(`${forkIdentity};after;${counterexample ?? "no-counterexample"}`);

  const finishedAt = new Date().toISOString();

  const experiment: ExecutedExperiment = {
    planId,
    // "passed" in ExperimentOutcome means the experiment RAN cleanly, not that
    // the contract is safe. A broken invariant shows up in invariantResult=FAIL.
    outcome: "passed",
    startedAt,
    finishedAt,
    environment: "local",
    commitSha: sha256(forkIdentity).slice(0, 40), // fork fingerprint, not a source commit
    traceHash,
    stateBeforeHash,
    stateAfterHash,
    invariantResult: result, // PASS | FAIL
    // We do NOT run a dedicated positive control (a known-broken case proving
    // the test can detect a break), so this is honestly false. "Did the attack
    // reproduce?" is answered by invariantResult === "FAIL", not by this flag.
    positiveControlPassed: false,
    negativeControlPassed,
    humanApproved: true,
  };

  return {
    experiment,
    reason: `${result === "FAIL"
      ? "Invariant BROKEN on forked contract. Candidate finding, review counterexample and reproduce independently."
      : "Invariant held. No finding on this path."} ${ncReason}`,
  };
}
