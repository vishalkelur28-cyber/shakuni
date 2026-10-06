"use client";

import { useState } from "react";

interface Item { number: number; title: string; url: string; state: string; isPr: boolean; createdAt: string }
interface Result { total?: number; items?: Item[]; error?: string; detail?: string }

export default function DedupChecker() {
  const [repo, setRepo] = useState("circlefin/stellar-cctp");
  const [query, setQuery] = useState("nonce replay");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/github-search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, query }),
      });
      setRes((await r.json()) as Result);
    } catch (e) {
      setRes({ error: e instanceof Error ? e.message : "Search failed" });
    }
    setBusy(false);
  }

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">
        Before you file, check the repo&apos;s own issues and pull requests for the same bug, a duplicate costs you the
        payout and dings your signal. Search the relevant keywords; also skim closed items (a rejected PoC is still prior art).
      </p>
      <div className="card card-p">
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-[2] flex-col gap-1.5"><span className="label">Repository (owner/name)</span><input className="input font-mono text-[12.5px]" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="circlefin/evm-gateway-contracts" /></label>
          <label className="flex min-w-0 flex-[2] flex-col gap-1.5"><span className="label">Keywords</span><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="reentrancy refund" /></label>
          <button type="submit" className="btn btn-primary" disabled={busy || !repo.trim() || !query.trim()}>{busy ? "Searching…" : "Search"}</button>
        </form>
      </div>

      {res && (
        <div className="mt-5">
          {res.error ? (
            <div className="callout callout-danger text-sm">{res.error}{res.detail ? <span className="block opacity-70">{res.detail}</span> : null}</div>
          ) : (res.items && res.items.length) ? (
            <>
              <p className="kicker mb-3">{res.total} match{res.total === 1 ? "" : "es"}, treat any close one as a likely duplicate</p>
              <div className="flex flex-col gap-2.5">
                {res.items.map((it) => (
                  <a key={it.number} href={it.url} target="_blank" rel="noopener noreferrer" className="card flex flex-wrap items-center gap-3 p-3.5 transition hover:bg-raised">
                    <span className={`badge ${it.state === "open" ? "badge-green" : "badge-gray"}`}>{it.state}</span>
                    <span className="badge badge-blue">{it.isPr ? "PR" : "issue"}</span>
                    <span className="font-mono text-xs text-gray-500">#{it.number}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] text-gray-200">{it.title}</span>
                    <span className="font-mono text-[11px] text-gray-600">{it.createdAt}</span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div className="well px-6 py-8 text-center text-sm text-gray-400">
              No matching issues or PRs. <b className="text-white">Not a guarantee of novelty</b>, also check published audits,
              the commit history, CVE databases, and prior HackerOne disclosures before you report.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
