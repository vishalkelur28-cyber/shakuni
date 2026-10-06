import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { localRequestProblem } from "../../../lib/security/local-only";

/**
 * /api/forge-run, write a Foundry test into the project's foundry/test dir and
 * run `forge test` on it, returning the output and pass/fail. Captures a
 * reproducible PoC. Local only; forge runs on your machine. Fork URL is optional
 * and must be a testnet (mainnet is refused, matching Shakuni's safety model).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOUNDRY = path.join(process.cwd(), "foundry");
const ANSI = /\u001b\[[0-9;]*m/g;

function run(args: string[]): Promise<{ out: string; code: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    execFile("forge", args, { cwd: FOUNDRY, timeout: 150_000, maxBuffer: 6 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const out = `${stdout ?? ""}${stderr ?? ""}`.replace(ANSI, "");
      if (!err) return resolve({ out, code: 0, timedOut: false });
      const e = err as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
      const timedOut = Boolean(e.killed);
      const code = typeof e.code === "number" ? e.code : 1;
      resolve({ out: out || String(e.message ?? "forge failed"), code, timedOut });
    });
  });
}

function looksMainnet(url: string): boolean {
  return /mainnet|:\/\/(eth|ethereum|polygon|arbitrum|optimism|base|avalanche)\b/i.test(url) && !/sepolia|testnet|goerli|fuji|holesky|devnet|localhost|127\.0\.0\.1/i.test(url);
}

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let b: { name?: unknown; source?: unknown; forkUrl?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 }); }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const source = typeof b.source === "string" ? b.source : "";
  const forkUrl = typeof b.forkUrl === "string" ? b.forkUrl.trim() : "";
  if (!/^[A-Za-z0-9_]{1,60}$/.test(name)) return NextResponse.json({ error: "name must be 1-60 chars: letters, digits, underscore." }, { status: 400 });
  if (!source.trim()) return NextResponse.json({ error: "source is required." }, { status: 400 });
  if (source.length > 200_000) return NextResponse.json({ error: "Source too large." }, { status: 400 });
  if (forkUrl && looksMainnet(forkUrl)) return NextResponse.json({ error: "Mainnet fork refused, use a testnet RPC." }, { status: 400 });

  try {
    await mkdir(path.join(FOUNDRY, "test"), { recursive: true });
    const file = `test/${name}.t.sol`;
    await writeFile(path.join(FOUNDRY, file), source, "utf8");
    const args = ["test", "--match-path", file, "-vvv"];
    if (forkUrl) args.push("--fork-url", forkUrl);
    const r = await run(args);
    return NextResponse.json({ output: r.out.slice(0, 200_000), passed: r.code === 0, exitCode: r.code, timedOut: r.timedOut, file });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "forge-run failed." }, { status: 200 });
  }
}
