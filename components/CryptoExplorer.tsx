"use client";

import { useMemo, useState } from "react";

interface Domain { id: string; name: string; layers: readonly string[]; invariants: readonly string[] }

/** Searchable research domains. Cards collapse invariants beyond the first few. */
export default function CryptoExplorer({ domains, dimensions }: { domains: readonly Domain[]; dimensions: readonly string[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();

  const shownDomains = useMemo(() => !needle ? domains : domains.filter((d) =>
    [d.name, d.id, ...d.layers, ...d.invariants].some((t) => t.toLowerCase().includes(needle))), [domains, needle]);
  const shownDims = useMemo(() => !needle ? dimensions : dimensions.filter((d) => d.toLowerCase().includes(needle)), [dimensions, needle]);

  return (
    <div>
      <label className="sr-only" htmlFor="crypto-q">Search domains and dimensions</label>
      <input id="crypto-q" value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search chains, layers, invariants, e.g. replay" className="input max-w-md" />

      <section className="card card-p mt-6">
        <h2 className="h2">Universal security dimensions</h2>
        <p className="mt-0.5 text-sm text-gray-500">{shownDims.length} of {dimensions.length}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {shownDims.length ? shownDims.map((x) => <span key={x} className="chip">{x}</span>) : <span className="text-sm text-gray-500">No dimension matches.</span>}
        </div>
      </section>

      <p className="mt-8 text-sm text-gray-500">{shownDomains.length} of {domains.length} research domains</p>
      {shownDomains.length === 0
        ? <p className="well mt-3 p-6 text-center text-sm text-gray-500">No domain matches &ldquo;{q}&rdquo;.</p>
        : <div className="mt-3 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shownDomains.map((d) => {
            const expanded = open === d.id || Boolean(needle);
            const list = expanded ? d.invariants : d.invariants.slice(0, 4);
            return (
              <article key={d.id} className="card card-p">
                <p className="font-mono text-[11px] text-green-400">{d.id}</p>
                <h3 className="mt-1.5 font-semibold leading-snug">{d.name}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">{d.layers.map((x) => <span key={x} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">{x}</span>)}</div>
                <p className="kicker mt-5">Core invariants</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-gray-400">{list.map((x) => <li key={x}>• {x}</li>)}</ul>
                {!needle && d.invariants.length > 4 && (
                  <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={expanded} className="mt-3 text-xs text-accent hover:underline">{expanded ? "Show fewer" : `Show all ${d.invariants.length}`}</button>
                )}
              </article>
            );
          })}
        </div>}
    </div>
  );
}
