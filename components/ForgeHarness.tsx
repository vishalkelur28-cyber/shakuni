"use client";

import { useState } from "react";

interface Result { output?: string; passed?: boolean; exitCode?: number; timedOut?: boolean; file?: string; error?: string }

const TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

// Contract under test (inline, or import from foundry/src)
contract Target {
    uint256 public x;
    function set(uint256 v) external { x = v; }
}

contract PoC is Test {
    Target t;

    function setUp() public {
        t = new Target();
    }

    // Prove the finding. A passing assertion here is your reproducible PoC.
    function test_poc() public {
        t.set(42);
        assertEq(t.x(), 42);
    }

    // Or fuzz it:
    function testFuzz_poc(uint256 v) public {
        t.set(v);
        assertEq(t.x(), v);
    }
}`;

export default function ForgeHarness() {
  const [name, setName] = useState("PoC");
  const [forkUrl, setForkUrl] = useState("");
  const [src, setSrc] = useState(TEMPLATE);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/forge-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, source: src, forkUrl }) });
      setRes((await r.json()) as Result);
    } catch (e) {
      setRes({ error: e instanceof Error ? e.message : "Run failed" });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="callout callout-warn mb-5 text-xs leading-5">
        Runs <span className="font-mono">forge test</span> on your machine inside the <span className="font-mono">foundry/</span> project.
        The test is written to <span className="font-mono">foundry/test/&lt;name&gt;.t.sol</span>. Fork testing is testnet-only.
      </div>

      <div className="card card-p">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="flex flex-col gap-1.5"><span className="label">Test name</span><input className="input font-mono text-[12.5px]" value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Fork URL (optional, testnet)</span><input className="input font-mono text-[12px]" value={forkUrl} onChange={(e) => setForkUrl(e.target.value)} placeholder="https://…sepolia… (leave blank for a local unit test)" /></label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="label">Test source</span>
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setSrc(TEMPLATE)}>Reset template</button>
        </div>
        <textarea className="input mt-1.5 min-h-[320px] font-mono text-[12px] leading-5" spellCheck={false} value={src} onChange={(e) => setSrc(e.target.value)} />
        <button type="button" className="btn btn-primary mt-3" onClick={run} disabled={busy || !name || !src.trim()}>{busy ? "Running forge…" : "Run forge test"}</button>
      </div>

      {res && (
        <div className="mt-6">
          {res.error ? (
            <div className="callout callout-danger text-sm">{res.error}</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`badge ${res.passed ? "badge-green" : "badge-red"}`}>{res.timedOut ? "TIMED OUT" : res.passed ? "PASSED" : "FAILED"}</span>
                {typeof res.exitCode === "number" && <span className="font-mono text-xs text-gray-500">exit {res.exitCode}</span>}
                {res.file && <span className="font-mono text-xs text-gray-500">{res.file}</span>}
              </div>
              <pre className="max-h-[520px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3.5 font-mono text-[11.5px] leading-5 text-gray-200">{res.output || "(no output)"}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
