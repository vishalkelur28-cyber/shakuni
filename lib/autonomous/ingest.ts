import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { scopeFor } from "./scope.ts";

const exec = promisify(execFile);

/**
 * Repository ingestion. Clones the selected in-scope target into local dev,
 * pins the exact commit, applies the program's scope boundary, and inventories
 * the files that are actually in scope. Server-only.
 *
 * Everything is read-only research on authorized, in-scope source. Nothing is
 * executed here, this only fetches and measures the code.
 */

export const TARGETS_ROOT = join(process.cwd(), ".targets");

export interface Manifest {
  repository: string;
  commit: string;
  branch: string;
  clonedAt: string;
  path: string;
  scopeNote: string | null;
  totalFiles: number;
  inScopeFiles: number;
  inScopeBytes: number;
  languages: Record<string, number>; // extension -> % of in-scope files
  topDirs: { dir: string; files: number }[];
}

const IGNORE_DIRS = new Set([".git", "node_modules", "target", "vendor", "dist", "build", ".github"]);

/** Is a repo-relative path in scope for this target? Encodes the program's scope note. */
export function inScopePath(repo: string, relPath: string): boolean {
  const segs = relPath.split(/[\\/]/);
  if (segs.some((s) => IGNORE_DIRS.has(s))) return false;
  if (repo.toLowerCase() === "circlefin/malachite") {
    // "code/crates minus the starknet and test folders; everything outside code/crates is out of scope."
    if (!(segs[0] === "code" && segs[1] === "crates")) return false;
    if (segs.some((s) => s === "starknet" || s === "test" || s === "tests")) return false;
  }
  return true;
}

const LANG_BY_EXT: Record<string, string> = {
  rs: "rust", go: "go", ts: "typescript", tsx: "typescript", js: "javascript",
  sol: "solidity", py: "python", toml: "config", yaml: "config", yml: "config", json: "config", md: "docs",
};

async function walk(root: string, repo: string): Promise<{ rel: string; bytes: number }[]> {
  const out: { rel: string; bytes: number }[] = [];
  async function rec(dir: string) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) await rec(abs); }
      else if (e.isFile()) {
        const rel = relative(root, abs);
        try { const st = await stat(abs); out.push({ rel, bytes: st.size }); } catch { /* skip */ }
      }
    }
  }
  await rec(root);
  return out;
}

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

/** Clone (or update) the repo into local dev and build its in-scope manifest. */
export async function ingestTarget(repo: string): Promise<Manifest> {
  const scope = scopeFor(repo);
  if (!scope) throw new Error(`${repo} is not an in-scope target.`);
  const name = repo.split("/")[1];
  const dir = join(TARGETS_ROOT, name);
  await mkdir(TARGETS_ROOT, { recursive: true });

  if (!existsSync(join(dir, ".git"))) {
    await git(["clone", "--depth", "1", `https://github.com/${repo}.git`, dir]);
  } else {
    await git(["fetch", "--depth", "1", "origin"], dir).catch(() => undefined);
    await git(["reset", "--hard", "origin/HEAD"], dir).catch(() => undefined);
  }
  const commit = await git(["rev-parse", "HEAD"], dir);
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], dir).catch(() => "HEAD");

  const files = await walk(dir, repo);
  const scoped = files.filter((f) => inScopePath(repo, f.rel));

  const langCounts: Record<string, number> = {};
  const dirCounts: Record<string, number> = {};
  for (const f of scoped) {
    const ext = f.rel.split(".").pop()?.toLowerCase() ?? "";
    const lang = LANG_BY_EXT[ext] ?? "other";
    langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    const top = f.rel.split(/[\\/]/).slice(0, 3).join("/");
    dirCounts[top] = (dirCounts[top] ?? 0) + 1;
  }
  const total = scoped.length || 1;
  const languages = Object.fromEntries(Object.entries(langCounts).map(([k, v]) => [k, Math.round((v / total) * 100)]).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)));
  const topDirs = Object.entries(dirCounts).map(([dir, files]) => ({ dir, files })).sort((a, b) => b.files - a.files).slice(0, 8);

  return {
    repository: repo,
    commit,
    branch,
    clonedAt: new Date().toISOString(),
    path: dir,
    scopeNote: scope.scopeNote,
    totalFiles: files.length,
    inScopeFiles: scoped.length,
    inScopeBytes: scoped.reduce((n, f) => n + f.bytes, 0),
    languages,
    topDirs,
  };
}
