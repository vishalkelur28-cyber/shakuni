"use client";

import { useMemo, useState } from "react";

type Row = { type: "same" | "add" | "del"; text: string };

function diffLines(aText: string, bText: string): Row[] {
  const a = aText.split(/\r?\n/);
  const b = bText.split(/\r?\n/);
  const n = a.length, m = b.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: Row[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { rows.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ type: "del", text: a[i] }); i++; }
    else { rows.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < n) rows.push({ type: "del", text: a[i++] });
  while (j < m) rows.push({ type: "add", text: b[j++] });
  return rows;
}

export default function Comparer() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [go, setGo] = useState(false);

  const rows = useMemo(() => (go ? diffLines(a, b) : []), [go, a, b]);
  const stats = useMemo(() => {
    let add = 0, del = 0; for (const r of rows) { if (r.type === "add") add++; else if (r.type === "del") del++; } return { add, del };
  }, [rows]);

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">Diff two responses or payloads line by line, like Burp&apos;s Comparer. Runs in your browser.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="label">A</span>
          <textarea className="input min-h-[200px] font-mono text-[12px]" spellCheck={false} value={a} onChange={(e) => { setA(e.target.value); setGo(false); }} placeholder="Paste the first text" />
        </label>
        <label className="flex flex-col gap-1.5"><span className="label">B</span>
          <textarea className="input min-h-[200px] font-mono text-[12px]" spellCheck={false} value={b} onChange={(e) => { setB(e.target.value); setGo(false); }} placeholder="Paste the second text" />
        </label>
      </div>
      <button type="button" className="btn btn-primary mt-3" onClick={() => setGo(true)} disabled={!a && !b}>Compare</button>

      {go && (
        <div className="mt-5">
          <div className="mb-3 flex gap-2">
            <span className="badge badge-green">+{stats.add} added</span>
            <span className="badge badge-red">-{stats.del} removed</span>
            {stats.add === 0 && stats.del === 0 && <span className="badge badge-gray">identical</span>}
          </div>
          <pre className="overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-5">
            {rows.map((r, i) => (
              <div key={i} className={r.type === "add" ? "text-green-300" : r.type === "del" ? "text-red-300" : "text-gray-400"}>
                {r.type === "add" ? "+ " : r.type === "del" ? "- " : "  "}{r.text || " "}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
