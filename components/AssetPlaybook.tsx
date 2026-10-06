"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ASSETS, FITS, FIT, type Fit } from "../lib/knowledge/asset-playbook";

export default function AssetPlaybook() {
  const [filter, setFilter] = useState<Fit | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of ASSETS) c[a.fit] = (c[a.fit] ?? 0) + 1;
    return c;
  }, []);

  const shown = filter === "all" ? ASSETS : ASSETS.filter((a) => a.fit === filter);

  return (
    <div>
      <p className="muted mb-5 max-w-3xl">
        Every HackerOne asset type, with what to do, what to look for, and the tools to use.
        Shakuni&apos;s own tools link straight to the page; external tools show how to get them.
        Your strongest lanes are Source Code, Smart Contract, API and AI Model.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("all")}
          className={`chip transition ${filter === "all" ? "text-white" : "text-gray-400 hover:text-white"}`}
          style={filter === "all" ? { borderColor: "#8fb0ff", boxShadow: "inset 0 0 0 1px #8fb0ff" } : undefined}>
          All <span className="opacity-60">{ASSETS.length}</span>
        </button>
        {FITS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={`chip transition ${filter === f.id ? "text-white" : "text-gray-400 hover:text-white"}`}
            style={filter === f.id ? { borderColor: f.color, boxShadow: `inset 0 0 0 1px ${f.color}` } : undefined}>
            {f.label} <span className="opacity-60">{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {filter !== "all" && <p className="muted mt-4">{FIT[filter].meaning}</p>}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {shown.map((a) => {
          const f = FIT[a.fit];
          return (
            <article key={a.id} className="card min-w-0 border-l-4 p-4 sm:p-5" style={{ borderLeftColor: f.color }}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight">{a.name}</h3>
                <span className="badge text-black" style={{ background: f.color }}>{f.label}</span>
              </div>
              <p className="mt-2.5 text-[13px] leading-5 text-gray-400">{a.what}</p>

              <p className="kicker mt-3.5 mb-1.5">What to do</p>
              <ol className="flex flex-col gap-1.5">
                {a.approach.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[9px] text-gray-400">{i + 1}</span>
                    <span className="text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>

              <p className="mt-3 text-[12.5px] leading-5 text-gray-400"><span className="text-gray-500">Look for:</span> {a.lookFor}</p>

              <p className="kicker mt-3.5 mb-1.5">Tools to use</p>
              <div className="flex flex-col gap-1">
                {a.tools.map((t) =>
                  t.href ? (
                    <Link key={t.name} href={t.href} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-raised">
                      <span className="badge badge-green">Shakuni</span>
                      <span className="text-[12.5px] font-medium text-accent">{t.name}</span>
                      <span className="text-[12px] text-gray-500">{t.purpose}</span>
                    </Link>
                  ) : (
                    <div key={t.name} className="rounded-lg px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-gray">External</span>
                        <span className="text-[12.5px] font-medium text-gray-200">{t.name}</span>
                        <span className="text-[12px] text-gray-500">{t.purpose}</span>
                      </div>
                      {t.get && <p className="mt-0.5 pl-1 font-mono text-[11px] text-gray-600">{t.get}</p>}
                    </div>
                  ),
                )}
              </div>

              {a.needs && <p className="mt-3 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-[12px] leading-5 text-gray-400"><span className="font-semibold text-gray-300">You provide:</span> {a.needs}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
