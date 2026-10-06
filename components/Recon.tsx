"use client";

import { useState } from "react";

type Op = "subdomains" | "dns" | "probe" | "discover" | "wayback";
const OPS: { id: Op; label: string; input: "domain" | "url"; replaces: string }[] = [
  { id: "subdomains", label: "Subdomains", input: "domain", replaces: "subfinder (via crt.sh)" },
  { id: "dns", label: "DNS records", input: "domain", replaces: "dnsx / dig" },
  { id: "probe", label: "Host probe", input: "url", replaces: "httpx" },
  { id: "discover", label: "Content discovery", input: "url", replaces: "ffuf / gobuster" },
  { id: "wayback", label: "Wayback URLs", input: "domain", replaces: "gau / waybackurls" },
];

function statusClass(s: number): string {
  if (s >= 200 && s < 300) return "badge-green";
  if (s >= 300 && s < 400) return "badge-blue";
  if (s >= 400 && s < 500) return "badge-yellow";
  return "badge-red";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Recon() {
  const [op, setOp] = useState<Op>("subdomains");
  const [domain, setDomain] = useState("example.com");
  const [url, setUrl] = useState("https://example.com");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const meta = OPS.find((o) => o.id === op)!;

  async function run() {
    setBusy(true); setRes(null);
    try {
      const body: any = { op };
      if (meta.input === "domain") body.domain = domain; else body.url = url;
      const r = await fetch("/api/recon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setRes(await r.json());
    } catch (e) {
      setRes({ error: e instanceof Error ? e.message : "Recon failed" });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="callout callout-warn mb-5 text-xs leading-5">
        <b>Authorized, in-scope targets only.</b> Passive and light active recon from this machine. No aggressive scanning.
      </div>

      <div className="flex flex-wrap gap-2">
        {OPS.map((o) => (
          <button key={o.id} type="button" onClick={() => { setOp(o.id); setRes(null); }}
            className={`chip transition ${op === o.id ? "!border-accent text-white ring-1 ring-accent" : "hover:border-accent/60"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted mt-2 text-xs">Replaces: <span className="font-mono text-gray-400">{meta.replaces}</span></p>

      <div className="card card-p mt-4">
        <div className="flex flex-wrap items-end gap-3">
          {meta.input === "domain" ? (
            <label className="flex min-w-0 flex-1 flex-col gap-1.5"><span className="label">Domain</span><input className="input font-mono text-[12.5px]" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" /></label>
          ) : (
            <label className="flex min-w-0 flex-1 flex-col gap-1.5"><span className="label">URL</span><input className="input font-mono text-[12.5px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /></label>
          )}
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Running..." : "Run"}</button>
        </div>
      </div>

      {res && (
        <div className="mt-5">
          {res.error ? (
            <div className="callout callout-danger text-sm">{res.error}</div>
          ) : op === "subdomains" ? (
            <>
              <p className="kicker mb-2">{res.count} subdomains</p>
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] text-gray-300">{(res.subdomains || []).join("\n") || "(none)"}</pre>
            </>
          ) : op === "dns" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {["A", "AAAA", "CNAME", "MX", "TXT", "NS"].map((k) => (
                <div key={k} className="card card-p min-w-0">
                  <p className="kicker mb-1.5">{k}</p>
                  <pre className="overflow-auto font-mono text-[12px] text-gray-300">{(res[k] || []).join("\n") || "(none)"}</pre>
                </div>
              ))}
            </div>
          ) : op === "probe" ? (
            <div className="card card-p">
              <div className="mb-2 flex items-center gap-2"><span className={`badge ${statusClass(res.status)}`}>{res.status || "ERR"}</span>{res.title && <b className="text-sm">{res.title}</b>}</div>
              <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 font-mono text-[12px] text-gray-400">
                {res.server && <><dt>server</dt><dd className="text-gray-300">{res.server}</dd></>}
                {res.poweredBy && <><dt>powered-by</dt><dd className="text-gray-300">{res.poweredBy}</dd></>}
                {res.location && <><dt>location</dt><dd className="text-gray-300 break-all">{res.location}</dd></>}
              </dl>
            </div>
          ) : op === "discover" ? (
            <>
              <p className="kicker mb-2">{(res.hits || []).length} hits of {res.tested} paths tested</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500"><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Path</th><th className="py-2 font-medium">Length</th></tr></thead>
                  <tbody>
                    {(res.hits || []).map((h: any, i: number) => (
                      <tr key={i} className="border-b border-white/[.05]"><td className="py-2 pr-3"><span className={`badge ${statusClass(h.status)}`}>{h.status}</span></td><td className="py-2 pr-3 font-mono text-[12px] text-gray-300">/{h.path}</td><td className="py-2 font-mono text-xs text-gray-500">{h.len}</td></tr>
                    ))}
                    {(res.hits || []).length === 0 && <tr><td colSpan={3} className="py-4 text-center text-sm text-gray-500">No interesting paths found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="kicker mb-2">{(res.urls || []).length} historical URLs (capped at 300)</p>
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11.5px] text-gray-300">{(res.urls || []).join("\n") || "(none)"}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
