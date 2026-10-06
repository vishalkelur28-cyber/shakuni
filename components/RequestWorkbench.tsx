"use client";

import { useState } from "react";

interface SendResult {
  status: number;
  headers?: Record<string, string>;
  body?: string;
  timeMs?: number;
  size?: number;
  truncated?: boolean;
  error?: string;
}

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

async function sendRequest(method: string, url: string, headers: Record<string, string>, body?: string): Promise<SendResult> {
  try {
    const res = await fetch("/api/http-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, url, headers, body }),
    });
    return (await res.json()) as SendResult;
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : "Request failed" };
  }
}

function statusClass(s: number): string {
  if (s >= 200 && s < 300) return "badge-green";
  if (s >= 300 && s < 400) return "badge-blue";
  if (s >= 400 && s < 500) return "badge-yellow";
  return "badge-red";
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
type Tab = "repeater" | "intruder" | "idor";

export default function RequestWorkbench() {
  const [tab, setTab] = useState<Tab>("repeater");
  return (
    <div>
      <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
        {([["repeater", "Repeater"], ["intruder", "Intruder"], ["idor", "IDOR matrix"]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === v ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="callout callout-warn mt-5 text-xs leading-5">
        <b>Authorized testing only.</b> Use the program&apos;s sandbox/testnet, your own accounts, and stay within scope.
        Requests are sent from this machine; keep it non-volumetric (no DoS, no brute force).
      </div>

      <div className="mt-5">{tab === "repeater" ? <Repeater /> : tab === "intruder" ? <Intruder /> : <IdorMatrix />}</div>
    </div>
  );
}

interface IntruderRow { payload: string; status: number; len: number; ms: number; err?: string }

function Intruder() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api-sandbox.circle.com/user/FUZZ");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [marker, setMarker] = useState("FUZZ");
  const [payloads, setPayloads] = useState("admin\nroot\ntest\n1\n2\n../\n%2e%2e%2f");
  const [rows, setRows] = useState<IntruderRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const list = payloads.split(/\r?\n/).filter((p) => p.length).slice(0, 200);
    if (!list.length || !marker) return;
    setBusy(true); setRows([]);
    const h = parseHeaders(headers);
    const sub = (s: string, p: string) => s.split(marker).join(p);
    const collected: IntruderRow[] = [];
    for (const p of list) {
      const hh: Record<string, string> = {};
      for (const k in h) hh[k] = sub(h[k], p);
      const r = await sendRequest(method, sub(url, p), hh, body ? sub(body, p) : undefined);
      collected.push({ payload: p, status: r.status, len: r.size ?? (r.body?.length ?? 0), ms: r.timeMs ?? 0, err: r.error });
      setRows([...collected]);
      await new Promise((res) => setTimeout(res, 250)); // keep it non-volumetric
    }
    setBusy(false);
  }

  const common = (() => {
    if (!rows || !rows.length) return null;
    const m: Record<number, number> = {};
    for (const r of rows) if (!r.err) m[r.len] = (m[r.len] || 0) + 1;
    let best: number | null = null, bc = -1;
    for (const k in m) if (m[k] > bc) { bc = m[k]; best = Number(k); }
    return best;
  })();

  return (
    <div>
      <p className="muted mb-4 max-w-3xl">
        Burp Intruder style fuzzing. Put the marker <span className="font-mono text-gray-200">{marker || "FUZZ"}</span> anywhere in the URL,
        headers or body; each payload is substituted and sent. A status or length that differs from the common result is flagged as an anomaly.
      </p>
      <div className="card card-p">
        <div className="flex gap-2">
          <select className="input max-w-[120px]" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          <input className="input font-mono text-[12.5px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://host/FUZZ" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-1.5"><span className="label">Headers (Key: Value per line)</span><textarea className="input min-h-[60px] font-mono text-[12px]" spellCheck={false} value={headers} onChange={(e) => setHeaders(e.target.value)} /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Marker</span><input className="input font-mono" value={marker} onChange={(e) => setMarker(e.target.value)} /></label>
        </div>
        <label className="label mt-3 block">Body</label>
        <textarea className="input mt-1.5 min-h-[60px] font-mono text-[12px]" spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)} />
        <label className="label mt-3 block">Payloads (one per line, max 200)</label>
        <textarea className="input mt-1.5 min-h-[120px] font-mono text-[12px]" spellCheck={false} value={payloads} onChange={(e) => setPayloads(e.target.value)} />
        <button type="button" className="btn btn-primary mt-3" onClick={run} disabled={busy}>{busy ? "Running..." : "Start attack"}</button>
      </div>
      {rows && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500"><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Payload</th><th className="py-2 pr-3 font-medium">Length</th><th className="py-2 font-medium">Time</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const odd = common !== null && !r.err && r.len !== common;
                return (
                  <tr key={i} className={`border-b border-white/[.05] ${odd ? "bg-accent/5" : ""}`}>
                    <td className="py-2 pr-3"><span className={`badge ${statusClass(r.status)}`}>{r.status || "ERR"}</span></td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-gray-300">{r.payload || "(empty)"}{odd && <span className="ml-2 text-[10px] text-accent">anomaly</span>}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-400">{r.err ? "-" : r.len}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{r.err ? r.err : `${r.ms} ms`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Repeater() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api-sandbox.circle.com/ping");
  const [headers, setHeaders] = useState("Content-Type: application/json");
  const [body, setBody] = useState("");
  const [res, setRes] = useState<SendResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setRes(null);
    setRes(await sendRequest(method, url, parseHeaders(headers), body));
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card card-p min-w-0">
        <div className="flex gap-2">
          <select className="input max-w-[120px]" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <input className="input font-mono text-[12.5px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <label className="label mt-3 block">Headers (one per line, <span className="font-mono">Key: Value</span>)</label>
        <textarea className="input mt-1.5 min-h-[88px] font-mono text-[12px]" spellCheck={false} value={headers} onChange={(e) => setHeaders(e.target.value)} />
        <label className="label mt-3 block">Body</label>
        <textarea className="input mt-1.5 min-h-[88px] font-mono text-[12px]" spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)} placeholder={'{"key":"value"}'} />
        <button type="button" className="btn btn-primary mt-3" onClick={go} disabled={busy || !url.trim()}>{busy ? "Sending…" : "Send"}</button>
      </div>

      <div className="card card-p min-w-0">
        {!res ? (
          <p className="text-sm text-gray-500">Response appears here.</p>
        ) : res.error ? (
          <div className="callout callout-danger text-sm">{res.error}</div>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${statusClass(res.status)}`}>{res.status || "ERR"}</span>
              {typeof res.timeMs === "number" && <span className="font-mono text-xs text-gray-500">{res.timeMs} ms</span>}
              {typeof res.size === "number" && <span className="font-mono text-xs text-gray-500">{res.size} B{res.truncated ? " (truncated)" : ""}</span>}
            </div>
            {res.headers && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-400">Response headers ({Object.keys(res.headers).length})</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11.5px] text-gray-300">{Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
              </details>
            )}
            <label className="label mt-3 block">Body</label>
            <pre className="mt-1.5 max-h-[320px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11.5px] text-gray-300">{(res.body ?? "").slice(0, 40000) || "(empty)"}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

interface Row { path: string; status: number; ms?: number; err?: string }

function IdorMatrix() {
  const [base, setBase] = useState("https://api-sandbox.circle.com");
  const [method, setMethod] = useState("GET");
  const [creds, setCreds] = useState("Authorization: Bearer <ACCOUNT_A_KEY>");
  const [paths, setPaths] = useState("/v1/wallets/{B_WALLET_ID}\n/v1/users/{B_USER_ID}");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const list = paths.split(/\r?\n/).map((p) => p.trim()).filter(Boolean).slice(0, 60);
    if (!list.length) return;
    setBusy(true); setRows([]);
    const h = parseHeaders(creds);
    const collected: Row[] = [];
    for (const p of list) {
      const url = base.replace(/\/$/, "") + (p.startsWith("/") ? p : "/" + p);
      const r = await sendRequest(method, url, h);
      collected.push({ path: p, status: r.status, ms: r.timeMs, err: r.error });
      setRows([...collected]);
      await new Promise((res) => setTimeout(res, 350)); // keep it non-volumetric
    }
    setBusy(false);
  }

  return (
    <div>
      <p className="muted mb-4 max-w-3xl">
        Cross-tenant authorization probe. Put <b className="text-white">account A&apos;s credentials</b> below and
        <b className="text-white"> account B&apos;s resource IDs</b> in the paths (both accounts yours). Any
        <span className="badge badge-green mx-1">2xx</span> means A reached B&apos;s object, a potential IDOR/BOLA finding to verify.
      </p>
      <div className="card card-p">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="flex flex-col gap-1.5"><span className="label">Base URL</span><input className="input font-mono text-[12.5px]" value={base} onChange={(e) => setBase(e.target.value)} /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Method</span><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
        </div>
        <label className="label mt-3 block">Account A credentials (headers)</label>
        <textarea className="input mt-1.5 min-h-[66px] font-mono text-[12px]" spellCheck={false} value={creds} onChange={(e) => setCreds(e.target.value)} />
        <label className="label mt-3 block">Paths, one per line, with account B&apos;s IDs</label>
        <textarea className="input mt-1.5 min-h-[96px] font-mono text-[12px]" spellCheck={false} value={paths} onChange={(e) => setPaths(e.target.value)} />
        <button type="button" className="btn btn-primary mt-3" onClick={run} disabled={busy}>{busy ? "Running…" : "Run A → B"}</button>
      </div>

      {rows && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
              <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Path</th><th className="py-2 pr-3 font-medium">Time</th><th className="py-2 font-medium">Verdict</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const hit = r.status >= 200 && r.status < 300;
                return (
                  <tr key={i} className="border-b border-white/[.05]">
                    <td className="py-2 pr-3"><span className={`badge ${statusClass(r.status)}`}>{r.status || "ERR"}</span></td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-gray-300">{r.path}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">{r.err ? "-" : `${r.ms ?? 0} ms`}</td>
                    <td className="py-2 text-xs">{r.err ? <span className="text-gray-500">{r.err}</span> : hit ? <span className="font-semibold text-red-300">▲ investigate (A reached B)</span> : <span className="text-gray-500">rejected (expected)</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
