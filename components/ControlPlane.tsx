"use client";

import { useState } from "react";

interface Capability { id: string; kind: string; name: string; purpose: string; safetyBoundary: string }

/** Capability grid with group filter. One flat grid so rows stay full. */
export default function ControlPlane({ capabilities }: { capabilities: readonly Capability[] }) {
  const groups = Array.from(new Set(capabilities.map((c) => c.kind)));
  const [group, setGroup] = useState<string>("all");
  const ordered = groups.flatMap((g) => capabilities.filter((c) => c.kind === g));
  const shown = group === "all" ? ordered : ordered.filter((c) => c.kind === group);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by group">
        {["all", ...groups].map((g) => {
          const n = g === "all" ? capabilities.length : capabilities.filter((c) => c.kind === g).length;
          return (
            <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g} className={`rounded-full border px-3 py-1 text-xs capitalize transition ${group === g ? "border-white bg-white text-black" : "border-white/10 text-gray-400 hover:bg-white/5"}`}>
              {g} · {n}
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <article key={c.id} className="card card-p flex h-full flex-col">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] text-green-400">{c.id}</p>
              <span className="badge badge-gray capitalize">{c.kind}</span>
            </div>
            <h3 className="mt-3 font-semibold">{c.name}</h3>
            <p className="muted mt-1.5">{c.purpose}</p>
            <p className="mt-auto border-t border-white/[.06] pt-3 text-xs leading-5 text-gray-500">{c.safetyBoundary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
