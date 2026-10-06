"use client";

import { useMemo, useState, type ReactNode } from "react";

const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"];

function build(f: {
  title: string; asset: string; severity: string; cwe: string;
  summary: string; steps: string; poc: string; impact: string; fix: string; dedup: string;
}): string {
  const steps = f.steps.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  out.push(`# ${f.title || "Untitled finding"}`, "");
  out.push(`**Asset:** ${f.asset || "-"}`);
  out.push(`**Severity:** ${f.severity}${f.cwe ? ` · ${f.cwe}` : ""}`, "");
  out.push("## Summary", f.summary.trim() || "_Describe the vulnerability in one or two sentences._", "");
  out.push("## Steps to Reproduce");
  if (steps.length) steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  else out.push("_One step per line._");
  out.push("");
  out.push("## Proof of Concept", "```", f.poc.trim() || "// paste a runnable PoC (e.g. a Foundry test or request sequence)", "```", "");
  out.push("## Impact", f.impact.trim() || "_What an attacker gains and who is affected._", "");
  if (f.fix.trim()) out.push("## Suggested Remediation", f.fix.trim(), "");
  out.push("## Prior art / dedup", f.dedup.trim() || "_Checked issues/PRs/commits, published audits and CVEs, not a known duplicate._", "");
  return out.join("\n");
}

export default function ReportBuilder() {
  const [title, setTitle] = useState("");
  const [asset, setAsset] = useState("");
  const [severity, setSeverity] = useState("High");
  const [cwe, setCwe] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [poc, setPoc] = useState("");
  const [impact, setImpact] = useState("");
  const [fix, setFix] = useState("");
  const [dedup, setDedup] = useState("");
  const [copied, setCopied] = useState(false);

  const md = useMemo(
    () => build({ title, asset, severity, cwe, summary, steps, poc, impact, fix, dedup }),
    [title, asset, severity, cwe, summary, steps, poc, impact, fix, dedup],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">
        Turn a verified finding into a clean, reproducible report. Every program wants the same shape:
        clear steps, a working PoC, honest impact, and a dedup note. Fill the fields; copy the Markdown.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card card-p min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cross-tenant mint via …" /></F>
            <F label="Asset"><input className="input" value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="api.circle.com / repo path" /></F>
            <F label="Severity"><select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></F>
            <F label="CWE / class (optional)"><input className="input" value={cwe} onChange={(e) => setCwe(e.target.value)} placeholder="CWE-639 IDOR" /></F>
          </div>
          <F label="Summary" mt><textarea className="input min-h-[60px]" value={summary} onChange={(e) => setSummary(e.target.value)} /></F>
          <F label="Steps to reproduce (one per line)" mt><textarea className="input min-h-[88px] font-mono text-[12.5px]" value={steps} onChange={(e) => setSteps(e.target.value)} /></F>
          <F label="Proof of concept (code / requests)" mt><textarea className="input min-h-[120px] font-mono text-[12px]" spellCheck={false} value={poc} onChange={(e) => setPoc(e.target.value)} /></F>
          <F label="Impact" mt><textarea className="input min-h-[60px]" value={impact} onChange={(e) => setImpact(e.target.value)} /></F>
          <F label="Suggested remediation (optional)" mt><textarea className="input min-h-[50px]" value={fix} onChange={(e) => setFix(e.target.value)} /></F>
          <F label="Prior art / dedup" mt><textarea className="input min-h-[50px]" value={dedup} onChange={(e) => setDedup(e.target.value)} placeholder="Checked issues/PRs/commits, audits, CVEs, not a duplicate." /></F>
        </div>

        <div className="card card-p min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="kicker">Report preview (Markdown)</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <pre className="max-h-[640px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3.5 font-mono text-[12px] leading-5 text-gray-200">{md}</pre>
        </div>
      </div>
    </div>
  );
}

function F({ label, children, mt }: { label: string; children: ReactNode; mt?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${mt ? "mt-3" : ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
