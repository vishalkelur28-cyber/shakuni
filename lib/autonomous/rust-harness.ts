import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { HARNESSES, harnessesForRepo, MALACHITE_HARNESSES, type HarnessDef } from "./harness-registry.ts";

export { HARNESSES, MALACHITE_HARNESSES, harnessesForRepo, type HarnessDef };

const exec = promisify(execFile);

/**
 * Runs REAL Rust property harnesses against a cloned in-scope repo's actual code.
 *
 * Each harness installs a Shakuni test into a cloned crate and runs it with
 * `cargo test`, driving the real component with randomized inputs and checking
 * a safety invariant. HELD = "could not break it" (the honest, valuable
 * outcome); BROKEN = a reproducible counterexample (seed printed).
 *
 * Server-only. Windows-native Rust (GNU) + mingw gcc (for C/asm deps) + perl
 * (from Git for Windows, for alloy's asm-keccak codegen). arc-node pins an old
 * toolchain; we override to stable. Override locations with SHAKUNI_CARGO,
 * SHAKUNI_MINGW_BIN, SHAKUNI_PERL_BIN, SHAKUNI_TOOLCHAIN.
 */

export interface HarnessResult {
  property: string;
  crate: string;
  commit: string;
  iters: number;
  quorumsVerified: number; // generic: checks independently verified
  violations: number;
  result: "HELD" | "BROKEN" | "ERROR";
  counterexample?: string;
  seconds: number;
  ranAt: string;
  raw: string;
}

export const CARGO = process.env.SHAKUNI_CARGO || join(process.env.USERPROFILE || process.env.HOME || "", ".cargo", "bin", "cargo.exe");
const MINGW_BIN = process.env.SHAKUNI_MINGW_BIN || "D:\\mingw64\\bin";
const PERL_BIN = process.env.SHAKUNI_PERL_BIN || "C:\\Program Files\\Git\\usr\\bin";
const TOOLCHAIN = process.env.SHAKUNI_TOOLCHAIN || "stable";
const TARGETS = join(process.cwd(), ".targets");
const HARNESS_DIR = join(process.cwd(), "lib", "autonomous", "harnesses");

export class HarnessError extends Error {}

/** Cargo workspace root for a cloned repo. malachite nests under code/; others are the repo root. */
function codeDir(repo: string): string {
  const name = repo.split("/")[1];
  const root = join(TARGETS, name);
  return name === "malachite" ? join(root, "code") : root;
}

function buildEnv(iters: number) {
  return {
    ...process.env,
    PATH: `${MINGW_BIN};${PERL_BIN};${process.env.PATH ?? ""}`,
    RUSTUP_TOOLCHAIN: TOOLCHAIN,
    SHAKUNI_ITERS: String(iters),
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, windowsHide: true });
  return stdout.trim();
}

/**
 * Some targets need extra dev-dependencies for Shakuni's harness to build; a
 * fresh ingest (git reset --hard) drops them, so re-apply them idempotently.
 */
async function ensureDevDeps(dir: string, def: HarnessDef): Promise<void> {
  if (def.repo.toLowerCase() !== "circlefin/arc-node") return;
  const manifest = join(dir, "crates", "types", "Cargo.toml");
  if (!existsSync(manifest)) return;
  const text = await readFile(manifest, "utf8");
  if (text.includes("malachitebft-core-consensus = { workspace = true }")) return;
  const add = "malachitebft-core-types = { workspace = true }\nmalachitebft-core-consensus = { workspace = true }\nalloy-primitives = { workspace = true }\n";
  let next: string;
  if (/^\[dev-dependencies\]\s*$/m.test(text)) {
    // Insert the lines right after the existing [dev-dependencies] header (one valid table).
    next = text.replace(/^\[dev-dependencies\]\s*\n/m, (m) => m + add);
  } else {
    next = `${text.trimEnd()}\n\n[dev-dependencies]\n${add}`;
  }
  await writeFile(manifest, next);
}

async function runOne(def: HarnessDef, iters: number, commit: string, timeoutMs: number): Promise<HarnessResult> {
  const dir = codeDir(def.repo);
  const dest = join(dir, def.destRel);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(join(HARNESS_DIR, def.srcFile), dest);
  await ensureDevDeps(dir, def);

  const useIters = def.capIters ? Math.min(iters, def.capIters) : iters;
  const started = Date.now();
  let raw = "";
  try {
    const { stdout, stderr } = await exec(
      CARGO,
      ["test", "-p", def.crate, "--test", def.testName, "--release", "--", "--nocapture"],
      { cwd: dir, env: buildEnv(useIters), windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs },
    );
    raw = `${stdout}\n${stderr}`;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; killed?: boolean; message?: string };
    if (err.killed) throw new HarnessError(`Harness ${def.property} exceeded ${Math.round(timeoutMs / 1000)}s and was killed.`);
    raw = `${err.stdout ?? ""}\n${err.stderr ?? ""}` || (err.message ?? "");
  }
  const seconds = Math.round((Date.now() - started) / 100) / 10;

  const prop = raw.match(/SHAKUNI_PROPERTY name=(\S+) iters=(\d+) quorums_verified=(\d+) violations=(\d+) result=(\w+)/);
  const broken = raw.match(/(QUORUM FORGERY|AGREEMENT BREAK|EVIDENCE MISMATCH|LOCKING VIOLATION|WAL REPLAY MISMATCH|CODEC ASYMMETRY|VALUE NONCONSERVATION)[^\n]*/);
  const passed = /test result: ok\. 1 passed/.test(raw);
  const base = { property: def.property, crate: def.crate, commit, seconds, ranAt: new Date().toISOString(), raw: raw.slice(-4000) };

  if (prop && passed) {
    return { ...base, iters: Number(prop[2]), quorumsVerified: Number(prop[3]), violations: Number(prop[4]), result: "HELD" };
  }
  if (broken) {
    return { ...base, iters: useIters, quorumsVerified: prop ? Number(prop[3]) : 0, violations: 1, result: "BROKEN", counterexample: broken[0] };
  }
  return { ...base, iters: useIters, quorumsVerified: 0, violations: 0, result: "ERROR" };
}

function preflight(repo: string) {
  if (!existsSync(codeDir(repo))) throw new HarnessError(`${repo} is not cloned yet. Run an autonomous hunt (it clones the repo) first.`);
  if (!existsSync(CARGO)) throw new HarnessError(`cargo not found at ${CARGO}. Install Rust (rustup) or set SHAKUNI_CARGO.`);
}

/** Run every harness registered for a repo and return their results. */
export async function runHarnessesForRepo(repo: string, iters = 30_000, timeoutMs = 1_200_000): Promise<HarnessResult[]> {
  const defs = harnessesForRepo(repo);
  if (!defs.length) return [];
  preflight(repo);
  const commit = await git(codeDir(repo), ["rev-parse", "HEAD"]).catch(() => "unknown");
  const results: HarnessResult[] = [];
  for (const def of defs) results.push(await runOne(def, iters, commit, timeoutMs));
  return results;
}

/** Back-compat: run every malachite harness. */
export async function runMalachiteHarnesses(iters = 30_000, timeoutMs = 600_000): Promise<HarnessResult[]> {
  return runHarnessesForRepo("circlefin/malachite", iters, timeoutMs);
}

/** Back-compat: run just the quorum harness. */
export async function runMalachiteQuorumHarness(iters = 50_000, timeoutMs = 600_000): Promise<HarnessResult> {
  preflight("circlefin/malachite");
  const dir = codeDir("circlefin/malachite");
  const commit = await git(dir, ["rev-parse", "HEAD"]).catch(() => "unknown");
  return runOne(MALACHITE_HARNESSES[0], iters, commit, timeoutMs);
}
