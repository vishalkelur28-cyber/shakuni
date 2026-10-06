"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { Callout, EmptyState, Stat } from "../../components/ui";
import { analyzeProgram } from "../../lib/bug-bounty/analyzer";
import { useWorkspace } from "../../lib/workspace/store";

const demoCsv = `asset_identifier,asset_type,eligible_for_bounty,eligible_for_submission,instruction,asset_labels\nexample.com,Domain,true,true,Web application,web;production\napi.example.com,Domain,true,true,API endpoints,api;rest\nlegacy.example.com,Domain,false,false,Decommissioned,web\nrepo-owner/repo,Source Code,true,true,Authorized source repository,github;typescript`;
const demoPolicy = `Safe harbor: research performed within this scope is authorized.\nYou must only test assets listed as in scope.\nReports must include clear reproduction steps.\nlegacy.example.com is out of scope and must not be tested.\nSource: https://github.com/repo-owner/repo\nTesting requires rust, typescript and docker tooling. Do not test production data of other users.`;

type Filter = "all" | "eligible" | "unknown" | "excluded";

export default function BugBountyImporter() {
  const { state, ready, setProgram } = useWorkspace();
  const profile = state.program;

  const [name, setName] = useState("");
  const [source, setSource] = useState("HackerOne-style CSV");
  const [csv, setCsv] = useState("");
  const [policy, setPolicy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const resultRef = useRef<HTMLElement>(null);
  const seeded = useRef(false);

  // Re-open a saved program for editing instead of showing an empty form next to saved results.
  useEffect(() => {
    if (!ready || seeded.current || !profile) return;
    seeded.current = true;
    setName(profile.name === "Imported Bug Bounty Program" ? "" : profile.name);
    setSource(profile.source);
    setPolicy(profile.policyText);
  }, [ready, profile]);

  const csvRows = useMemo(() => Math.max(0, csv.split(/\r?\n/).filter((l) => l.trim()).length - 1), [csv]);

  const stats = useMemo(() => profile ? {
    assets: profile.assets.length,
    eligible: profile.assets.filter((a) => a.eligibleForSubmission === true).length,
    unknown: profile.assets.filter((a) => a.eligibleForSubmission === null).length,
    excluded: profile.assets.filter((a) => a.eligibleForSubmission === false).length,
  } : null, [profile]);

  const visibleAssets = useMemo(() => (profile?.assets ?? []).filter((a) =>
    filter === "all" ? true
      : filter === "eligible" ? a.eligibleForSubmission === true
        : filter === "excluded" ? a.eligibleForSubmission === false
          : a.eligibleForSubmission === null), [profile, filter]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("That is not a CSV file. Export the scope table as .csv and try again.");
      return;
    }
    setSource(file.name);
    setCsv(await file.text());
    setError("");
    event.target.value = "";
  };

  const loadDemo = () => {
    setCsv(demoCsv);
    setPolicy(demoPolicy);
    setSource("Built-in demo");
    setName((n) => n || "Demo Program");
    setError("");
  };

  const analyze = () => {
    if (!csv.trim() && !policy.trim()) {
      setError("Add a scope CSV or paste the program policy first. Use Load demo to see how it works.");
      return;
    }
    setProgram(analyzeProgram({ name, source, csvText: csv, policyText: policy }));
    setError("");
    setFilter("all");
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div>
      <PageHeader
        step="intake"
        eyebrow="Program intake"
        title="Import a bug bounty program"
        description="Add the scope CSV and the policy text. Shakuni normalizes them into assets, eligibility, exclusions and research rules before any analysis begins."
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <section className="card card-p space-y-6" aria-label="Program details">
          <fieldset className="space-y-4">
            <legend className="kicker mb-3">1 · Program</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">Program name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arc Bug Bounty" className="input mt-1.5 font-normal" /></label>
              <label className="label">Source<input value={source} onChange={(e) => setSource(e.target.value)} className="input mt-1.5 font-normal" /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="kicker mb-3">2 · Scope CSV</legend>
            <div className="well flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{csv ? `${csvRows} row${csvRows === 1 ? "" : "s"} loaded` : "No file yet"}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{csv ? source : "HackerOne-style scope export or any CSV with an identifier column"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <label className="btn btn-primary btn-sm cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-accent">
                  Choose CSV
                  <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
                </label>
                <button type="button" onClick={loadDemo} className="btn btn-ghost btn-sm">Load demo</button>
                {csv && <button type="button" onClick={() => { setCsv(""); setSource("HackerOne-style CSV"); }} className="btn btn-ghost btn-sm">Remove</button>}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="kicker mb-3">3 · Policy and rules</legend>
            <label className="sr-only" htmlFor="policy">Program policy, rules and safe-harbor text</label>
            <textarea id="policy" value={policy} onChange={(e) => setPolicy(e.target.value)} placeholder="Paste the policy, scope instructions, exclusions, testing rules and disclosure requirements." className="input min-h-44 leading-6" />
          </fieldset>

          {error && <Callout tone="danger" role="alert">{error}</Callout>}
          <button type="button" onClick={analyze} className="btn btn-primary w-full py-3">{profile ? "Re-analyze program" : "Analyze program"} →</button>
        </section>

        <aside className="card card-p">
          <p className="kicker">What you get</p>
          <ol className="mt-4 space-y-4">
            {[
              ["Scope assets", "Domains, URLs, source code and apps, normalized."],
              ["Eligibility", "Submission and bounty eligibility kept separate."],
              ["Rules", "Safe harbor, testing requirements and exclusions."],
              ["Technology and repos", "Languages, infrastructure and GitHub repositories found."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] text-gray-400">{i + 1}</span>
                <div><p className="text-sm font-medium">{t}</p><p className="mt-0.5 text-xs leading-5 text-gray-500">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-6"><Callout tone="warn">A program profile does not authorize testing. Stay within the program&apos;s own authorization and scope.</Callout></div>
        </aside>
      </div>

      {profile && stats && (
        <section ref={resultRef} className="mt-10 scroll-mt-20" aria-live="polite" aria-label="Analysis result">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <span className="badge badge-green">Saved to workspace</span>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">{profile.name}</h2>
              <p className="mt-1 text-sm text-gray-500">Source: {profile.source} · Scope mode: {profile.scopeMode}</p>
            </div>
            <Link href="/external-analysis" className="btn btn-primary shrink-0">Next: Repository Analysis →</Link>
          </div>

          <div className="stat-grid mt-5">
            <Stat label="Assets" value={stats.assets} />
            <Stat label="Submission eligible" value={stats.eligible} />
            <Stat label="Eligibility unknown" value={stats.unknown} />
            <Stat label="Excluded" value={stats.excluded} />
          </div>

          {profile.warnings.length > 0 && (
            <div className="mt-4"><Callout tone="warn"><p className="font-medium">Check before continuing</p><ul className="mt-1 list-disc space-y-1 pl-5 text-[13px]">{profile.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Callout></div>
          )}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] px-4 py-3">
                <h3 className="text-sm font-semibold">Normalized assets</h3>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter assets">
                  {(["all", "eligible", "unknown", "excluded"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition ${filter === f ? "bg-white text-black" : "text-gray-400 hover:bg-white/5"}`}>{f}</button>
                  ))}
                </div>
              </div>
              {visibleAssets.length === 0 ? (
                <div className="p-4"><EmptyState title="No assets here" body={profile.assets.length ? "Nothing matches this filter." : "The CSV had no recognizable asset rows. Check that it has an identifier column."} /></div>
              ) : (
                <ul className="max-h-96 divide-y divide-white/5 overflow-auto">
                  {visibleAssets.map((a, i) => (
                    <li key={`${a.identifier}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{a.identifier || "Unnamed asset"}</p>
                        <p className="text-xs text-gray-500">{a.assetType}{a.labels.length ? ` · ${a.labels.join(", ")}` : ""}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`badge ${a.eligibleForSubmission === true ? "badge-green" : a.eligibleForSubmission === false ? "badge-red" : "badge-gray"}`}>{a.eligibleForSubmission === true ? "in scope" : a.eligibleForSubmission === false ? "excluded" : "unknown"}</span>
                        {a.eligibleForBounty === true && <span className="badge badge-blue">bounty</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <Info title="Technologies">{profile.technologies.length ? <div className="flex flex-wrap gap-1.5">{profile.technologies.map((t) => <span key={t} className="chip">{t}</span>)}</div> : <span className="text-gray-500">None detected</span>}</Info>
              <Info title="Repositories">{profile.repositories.length ? <ul className="space-y-1 break-all font-mono text-xs">{profile.repositories.map((r) => <li key={r}>{r}</li>)}</ul> : <span className="text-gray-500">None found in the policy text</span>}</Info>
              <Info title="Rules and requirements">{profile.requirements.length ? <ul className="list-disc space-y-1 pl-4 text-xs text-gray-400">{profile.requirements.slice(0, 8).map((r, i) => <li key={i}>{r}</li>)}</ul> : <span className="text-gray-500">None detected</span>}</Info>
              {profile.exclusions.length > 0 && <Info title="Exclusions"><ul className="list-disc space-y-1 pl-4 text-xs text-gray-400">{profile.exclusions.slice(0, 6).map((r, i) => <li key={i}>{r}</li>)}</ul></Info>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><p className="kicker">{title}</p><div className="mt-2 text-sm text-gray-300">{children}</div></div>;
}
