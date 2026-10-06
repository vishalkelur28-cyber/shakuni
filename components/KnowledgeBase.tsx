"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ENTRIES, CATEGORIES, CATEGORY, type Category, type Sev } from "../lib/knowledge/kb-data";

const SEV_BADGE: Record<Sev, string> = { critical: "badge-red", high: "badge-red", medium: "badge-yellow", low: "badge-gray", info: "badge-blue" };

export default function KnowledgeBase() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ENTRIES.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (!needle) return true;
      const hay = `${e.title} ${e.tags.join(" ")} ${e.what} ${e.find} ${e.note ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q, cat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of ENTRIES) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, []);

  return (
    <div>
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${ENTRIES.length} entries, e.g. "ssrf", "jwt", "reentrancy", "idor", "rust"…`}
        aria-label="Search the knowledge base"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill active={cat === "all"} onClick={() => setCat("all")} color="#8fb0ff">All <span className="opacity-60">{ENTRIES.length}</span></Pill>
        {CATEGORIES.map((c) => (
          <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} color={c.color}>
            {c.label} <span className="opacity-60">{counts[c.id] ?? 0}</span>
          </Pill>
        ))}
      </div>

      {cat !== "all" && <p className="muted mt-4">{CATEGORY[cat].blurb}</p>}

      <div className="mt-5">
        {results.length === 0 ? (
          <div className="well px-6 py-10 text-center text-sm text-gray-400">No entries match &ldquo;{q}&rdquo;. Try a broader term or another category.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {results.map((e) => {
              const c = CATEGORY[e.category];
              return (
                <article key={e.id} className="card min-w-0 border-l-4 p-4 sm:p-5" style={{ borderLeftColor: c.color }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold tracking-tight">{e.title}</h3>
                    {e.sev && <span className={`badge ${SEV_BADGE[e.sev]}`}>{e.sev}</span>}
                    <span className="badge text-black" style={{ background: c.color }}>{c.label}</span>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">What:</span> {e.what}</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-gray-300"><span className="text-gray-500">How to find:</span> {e.find}</p>
                  {e.example && (
                    <pre className="mt-2.5 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11.5px] leading-5 text-gray-300">{e.example}</pre>
                  )}
                  {e.note && (
                    <p className="mt-2 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-[12.5px] leading-5 text-gray-400">{e.note}</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {e.tags.map((t) => <span key={t} className="font-mono text-[10px] text-gray-600">#{t}</span>)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip transition ${active ? "text-white" : "text-gray-400 hover:text-white"}`}
      style={active ? { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      {children}
    </button>
  );
}
