import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../lib/security/local-only";

/**
 * /api/solc-analyze, compile Solidity with solc and run AST-level detectors.
 * Unlike the regex Contract Scanner, these walk the parsed syntax tree, so they
 * don't fire on comments/strings and can reason at the function level (modifiers,
 * visibility, mutability). solc is externalized (next.config) and required here.
 * Local only. Paste a self-contained contract, external imports won't resolve,
 * but the syntactic detectors still run on whatever AST solc produces.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");

interface Finding { id: string; title: string; severity: "high" | "medium" | "low"; line: number; where: string; means: string; confirm: string }

const META: Record<string, { means: string; confirm: string }> = {
  "tx-origin": { means: "Authorization via tx.origin lets a malicious intermediary contract act for a victim.", confirm: "If it gates access, it's a bug, use msg.sender." },
  "selfdestruct": { means: "Can delete the contract / force-send ETH.", confirm: "Verify who can trigger it and that it can't brick a live contract." },
  "ecrecover": { means: "Raw signature recovery is easy to get wrong.", confirm: "Verify malleability guard (s ≤ N/2, v ∈ {27,28}), zero-address check, and that the digest binds a nonce + domain." },
  "delegatecall": { means: "Runs external code in this contract's storage context.", confirm: "Verify the target is trusted/immutable and storage layout is compatible." },
  "initializer": { means: "Initializer with no initializer/reinitializer modifier, re-callable or front-runnable.", confirm: "Confirm the modifier is present and the deploy calls it atomically (upgradeToAndCall)." },
  "authorize-upgrade": { means: "UUPS _authorizeUpgrade has no access-control modifier, anyone may upgrade.", confirm: "Add onlyOwner / a role, or an explicit check in the body." },
  "priv-no-guard": { means: "A privileged-looking function is public/external and state-mutating with no modifier.", confirm: "Verify it authorizes the caller internally (require msg.sender == …) or add a modifier." },
};

function lineIndex(src: string): number[] {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}
function lineOf(starts: number[], offset: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function analyze(ast: any, starts: number[]): Finding[] {
  const out: Finding[] = [];
  const add = (id: string, title: string, severity: Finding["severity"], node: any, where: string) => {
    const offset = Number(String(node?.src ?? "0:0:0").split(":")[0]) || 0;
    out.push({ id, title, severity, line: lineOf(starts, offset), where, means: META[id].means, confirm: META[id].confirm });
  };

  function walk(node: any, contract: string, fn: string) {
    if (!node || typeof node !== "object") return;
    const nt = node.nodeType;

    if (nt === "ContractDefinition") contract = node.name || contract;
    if (nt === "FunctionDefinition") {
      fn = node.name || (node.kind === "constructor" ? "constructor" : "fallback");
      const mods: string[] = (node.modifiers ?? []).map((m: any) => m?.modifierName?.name ?? m?.modifierName?.namePath ?? "");
      const where = `${contract}.${fn}`;
      const mutates = node.stateMutability !== "view" && node.stateMutability !== "pure";
      const pub = node.visibility === "public" || node.visibility === "external";
      if (node.kind === "function" && /^initialize/i.test(fn) && !mods.some((m) => /initializer|reinitializer|onlyInitializing/i.test(m))) add("initializer", "Unprotected initializer", "high", node, where);
      if (fn === "_authorizeUpgrade" && mods.length === 0) add("authorize-upgrade", "UUPS upgrade hook unguarded", "high", node, where);
      if (pub && mutates && node.kind === "function" && mods.length === 0 && /^(mint|burn|withdraw|upgrade|pause|unpause|rescue|configure|init|set[A-Z]|add[A-Z]|remove[A-Z]|transferOwnership|grant|revoke|blocklist|allowlist)/.test(fn)) add("priv-no-guard", "Privileged function with no modifier", "medium", node, where);
    }
    if (nt === "MemberAccess" && node.memberName === "origin" && node.expression?.nodeType === "Identifier" && node.expression?.name === "tx") add("tx-origin", "Authorization via tx.origin", "high", node, `${contract}.${fn}`);
    if (nt === "MemberAccess" && node.memberName === "delegatecall") add("delegatecall", "delegatecall", "medium", node, `${contract}.${fn}`);
    if (nt === "FunctionCall" && node.expression?.nodeType === "Identifier") {
      const name = node.expression.name;
      if (name === "selfdestruct" || name === "suicide") add("selfdestruct", "selfdestruct", "high", node, `${contract}.${fn}`);
      if (name === "ecrecover") add("ecrecover", "Raw ecrecover", "medium", node, `${contract}.${fn}`);
    }

    for (const k of Object.keys(node)) {
      const v = (node as any)[k];
      if (Array.isArray(v)) for (const c of v) walk(c, contract, fn);
      else if (v && typeof v === "object") walk(v, contract, fn);
    }
  }
  walk(ast, "", "");
  const order = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity] || a.line - b.line);
  return out;
}

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let b: { source?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 }); }
  const source = typeof b.source === "string" ? b.source : "";
  if (!source.trim()) return NextResponse.json({ error: "source is required." }, { status: 400 });
  if (source.length > 300_000) return NextResponse.json({ error: "Source too large (300 KB max)." }, { status: 400 });

  try {
    const input = { language: "Solidity", sources: { "input.sol": { content: source } }, settings: { outputSelection: { "*": { "": ["ast"] } } } };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const ast = output?.sources?.["input.sol"]?.ast;
    const errors: string[] = (output?.errors ?? [])
      .filter((e: any) => e.severity === "error" && !/File not found|not found: File|Source .* not found/i.test(e.message || ""))
      .map((e: any) => (e.formattedMessage || e.message || "").slice(0, 300));
    const findings = ast ? analyze(ast, lineIndex(source)) : [];
    return NextResponse.json({ findings, errors, version: solc.version(), astAvailable: Boolean(ast) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Compile failed." }, { status: 200 });
  }
}
