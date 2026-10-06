"use client";

import { useState } from "react";

/** Searchable list of constitution rule IDs. */
export default function RuleSearch({ rules }: { rules: readonly string[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase().replace(/\s+/g, "_");
  const shown = needle ? rules.filter((r) => r.toLowerCase().includes(needle)) : rules;

  return (
    <div>
      <label className="sr-only" htmlFor="rule-q">Search rules</label>
      <input id="rule-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${rules.length} rules, e.g. evidence`} className="input max-w-sm" type="search" />
      {shown.length === 0
        ? <p className="mt-4 text-sm text-gray-500">No rule matches &ldquo;{q}&rdquo;.</p>
        : <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((rule) => <li key={rule} className="well break-all px-3 py-2.5 font-mono text-[11px] leading-5 text-green-400">{rule}</li>)}
        </ul>}
      {needle && <p className="mt-3 text-xs text-gray-500">{shown.length} of {rules.length} shown</p>}
    </div>
  );
}
