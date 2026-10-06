"use client";

import { useState } from "react";

interface Finding { id: string; title: string; severity: "high" | "medium" | "low"; line: number; where: string; means: string; confirm: string }
interface Result { findings?: Finding[]; errors?: string[]; version?: string; astAvailable?: boolean; error?: string }

const SEV_BADGE: Record<string, string> = { high: "badge-red", medium: "badge-yellow", low: "badge-gray" };

const SAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
  address owner;

  // tx.origin here is in a comment and must NOT be flagged (AST, not regex)
  function initialize(address o) external { owner = o; }

  function mint(address to, uint256 amt) external {
    require(tx.origin == owner, "not owner");
    (bool ok, ) = to.call{value: amt}("");
    require(ok);
  }

  function _authorizeUpgrade(address) internal {}
}`;

export default function SolcAnalyzer() {
  const [src, setSrc] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/solc-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: src }) });
      setRes((await r.json()) as Result);
    } catch (e) {
      setRes({ error: e instanceof Error ? e.message : "Analyze failed" });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="callout callout-info mb-5 text-xs leading-5">
        AST-level analysis via <span className="font-mono">solc</span>, detectors walk the parsed syntax tree, so a token inside a
        comment or string is never flagged, and function-level checks (initializer/upgrade modifiers, visibility) are exact.
        Paste a self-contained contract; external imports won&apos;t resolve, but the syntactic detectors still run.
      </div>

      <div className="card card-p">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSrc(SAMPLE); setRes(null); }}>Load sample</button>
          {res?.version && <span className="ml-auto font-mono text-xs text-gray-500">{res.version}</span>}
        </div>
        <textarea className="input mt-3 min-h-[280px] font-mono text-[12.5px] leading-5" spellCheck={false} placeholder="Paste Solidity source…" value={src} onChange={(e) => setSrc(e.target.value)} />
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={analyze} disabled={busy || !src.trim()}>{busy ? "Compiling…" : "Analyze"}</button>
          {src && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSrc(""); setRes(null); }}>Clear</button>}
        </div>
      </div>

      {res && (
        <div className="mt-6">
          {res.error ? (
            <div className="callout callout-danger text-sm">{res.error}</div>
          ) : (
            <>
              {res.errors && res.errors.length > 0 && (
                <details className="callout callout-warn mb-4 text-xs">
                  <summary className="cursor-pointer">{res.errors.length} compiler error(s), detectors still ran on the parsed AST</summary>
                  <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] leading-5">{res.errors.join("\n")}</pre>
                </details>
              )}
              {!res.astAvailable ? (
                <div className="well px-6 py-8 text-center text-sm text-gray-400">solc couldn&apos;t parse this into an AST. Check the compiler errors above (often a pragma newer than the bundled solc, or unbalanced syntax).</div>
              ) : res.findings && res.findings.length === 0 ? (
                <div className="well px-6 py-8 text-center text-sm text-gray-400">No AST detectors fired. Not proof it is clean, run the regex Contract Scanner too, and work the methodology checklist.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {res.findings!.map((f, i) => (
                    <div key={`${f.id}-${i}`} className="card card-p">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`badge ${SEV_BADGE[f.severity]}`}>{f.severity}</span>
                        <b className="text-sm">{f.title}</b>
                        <span className="font-mono text-xs text-gray-400">{f.where}</span>
                        <span className="font-mono text-xs text-gray-500">line {f.line}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">Means:</span> {f.means}</p>
                      <p className="mt-1 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">Confirm:</span> {f.confirm}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
