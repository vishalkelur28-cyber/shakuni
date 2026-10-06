"use client";

import { useMemo, useState } from "react";
import {
  RULES, CHECKLISTS, TRIAGE, LANG_OPTIONS,
  type Rule, type Severity, type Lang,
} from "../lib/blockchain/scanner-rules";

interface Finding { rule: Rule; line: number; snippet: string }

const SEV_BADGE: Record<Severity, string> = {
  high: "badge-red", medium: "badge-yellow", low: "badge-gray", info: "badge-blue",
};
const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };

const SAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
  address owner;

  // unprotected initializer + no atomic-deploy guard
  function initialize(address o) external { owner = o; }

  function mint(address to, uint256 amt) external {
    require(tx.origin == owner, "not owner");   // tx.origin auth
    (bool ok, ) = to.call{value: amt}("");       // low-level call
    require(ok);
  }

  function _authorizeUpgrade(address) internal {} // UUPS hook with no access control
}`;

function scan(src: string, lang: Lang | "auto"): Finding[] {
  if (!src.trim()) return [];
  const lines = src.split(/\r?\n/);
  const rules = RULES.filter((r) => lang === "auto" || r.langs.includes(lang) || r.langs.includes("any"));
  const out: Finding[] = [];
  for (const r of rules) {
    lines.forEach((line, i) => {
      if (r.pattern.test(line)) out.push({ rule: r, line: i + 1, snippet: line.trim().slice(0, 200) });
    });
  }
  out.sort((a, b) => SEV_ORDER[a.rule.severity] - SEV_ORDER[b.rule.severity] || a.line - b.line);
  return out;
}

type Tab = "scan" | "method";

export default function ContractScanner() {
  const [tab, setTab] = useState<Tab>("scan");
  const [lang, setLang] = useState<Lang | "auto">("auto");
  const [src, setSrc] = useState("");
  const [findings, setFindings] = useState<Finding[] | null>(null);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
    (findings ?? []).forEach((f) => { c[f.rule.severity]++; });
    return c;
  }, [findings]);

  return (
    <div>
      <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
        {([["scan", "Scan"], ["method", "Methodology"]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === v ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "scan" ? (
        <div className="mt-6">
          <div className="callout callout-warn mb-5 text-xs leading-5">
            <b>Patterns are leads, not bugs.</b> Every flag below is a place to look, a real finding has to pass the triage
            rubric (shown with the results). This runs entirely offline in your browser; nothing is sent anywhere.
          </div>

          <div className="card card-p">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="label">Language</span>
                <select className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang | "auto")}>
                  {LANG_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSrc(SAMPLE); setLang("solidity"); setFindings(null); }}>
                Load sample
              </button>
              <span className="ml-auto text-xs text-gray-500">{RULES.length} rules</span>
            </div>
            <textarea
              className="input mt-3 min-h-[260px] font-mono text-[12.5px] leading-5"
              spellCheck={false}
              placeholder="Paste contract or source code here…"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => setFindings(scan(src, lang))} disabled={!src.trim()}>
                Scan
              </button>
              {src && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSrc(""); setFindings(null); }}>Clear</button>}
            </div>
          </div>

          {findings !== null && (
            <div className="mt-6">
              {findings.length === 0 ? (
                <div className="well px-6 py-8 text-center text-sm text-gray-400">
                  No patterns matched. That is <b className="text-white">not proof it is clean</b>, heuristics miss most logic bugs.
                  Switch to the Methodology tab and work the checklist for this asset type.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="kicker mr-1">{findings.length} leads</span>
                    {(["high", "medium", "low", "info"] as Severity[]).map((s) => counts[s] > 0 && (
                      <span key={s} className={`badge ${SEV_BADGE[s]}`}>{counts[s]} {s}</span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3">
                    {findings.map((f, i) => (
                      <div key={`${f.rule.id}-${f.line}-${i}`} className="card card-p">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className={`badge ${SEV_BADGE[f.rule.severity]}`}>{f.rule.severity}</span>
                          <b className="text-sm">{f.rule.title}</b>
                          <span className="font-mono text-xs text-gray-500">line {f.line}</span>
                          <span className="font-mono text-[10px] text-gray-600">{f.rule.id}</span>
                        </div>
                        <pre className="mt-2.5 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-gray-300">{f.snippet}</pre>
                        <p className="mt-2.5 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">Means:</span> {f.rule.means}</p>
                        <p className="mt-1 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">Confirm:</span> {f.rule.confirm}</p>
                        {f.rule.fp && (
                          <p className="mt-2 rounded-lg border border-yellow-500/25 bg-yellow-500/[.06] px-3 py-2 text-[12.5px] leading-5 text-yellow-100/90">
                            <span className="font-semibold">Often a false positive:</span> {f.rule.fp}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="card card-p mt-6">
                    <p className="kicker mb-3">Before you report, triage every lead</p>
                    <ol className="flex flex-col gap-2.5">
                      {TRIAGE.map((t, i) => (
                        <li key={t.q} className="flex gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] text-gray-400">{i + 1}</span>
                          <span className="text-[13px] leading-5"><b>{t.q}</b> <span className="text-gray-400">{t.detail}</span></span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <Methodology />
      )}
    </div>
  );
}

function Methodology() {
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const cl = CHECKLISTS[idx];

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const doneHere = cl.items.filter((_, i) => checked.has(`${idx}:${i}`)).length;

  return (
    <div className="mt-6">
      <p className="muted mb-5 max-w-2xl">
        The real invariants to verify per asset type, the &ldquo;where to look&rdquo; that a pattern scan can&apos;t give you.
        This is the methodology our audits followed, as a working checklist.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {CHECKLISTS.map((c, i) => (
          <button key={c.assetType} type="button" onClick={() => setIdx(i)}
            className={`chip transition ${i === idx ? "!border-accent text-white ring-1 ring-accent" : "hover:border-accent/60"}`}>
            {c.assetType}
          </button>
        ))}
      </div>

      <div className="card card-p">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="h2">{cl.assetType}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{cl.blurb}</p>
          </div>
          <span className="font-mono text-xs text-gray-500">{doneHere}/{cl.items.length} checked</span>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {cl.items.map((it, i) => {
            const key = `${idx}:${i}`;
            const on = checked.has(key);
            return (
              <li key={key}>
                <button type="button" onClick={() => toggle(key)} className="flex w-full items-start gap-3 rounded-xl border border-white/[.06] bg-black/20 px-3.5 py-3 text-left transition hover:border-white/15">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${on ? "border-accent bg-accent text-black" : "border-white/20 text-transparent"}`}>✓</span>
                  <span className="min-w-0">
                    <span className={`text-[13.5px] leading-5 ${on ? "text-gray-500 line-through" : "text-gray-200"}`}>{it.q}</span>
                    {it.note && <span className="mt-0.5 block text-[12px] leading-5 text-gray-500">{it.note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
