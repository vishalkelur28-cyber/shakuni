'use client';

import Link from 'next/link';
import { useMemo, useState, type ClipboardEvent } from 'react';
import PageHeader from '../../components/PageHeader';
import { Callout, EmptyState, Stat } from '../../components/ui';
import type { GitHubRecord } from '../../lib/github/types';
import { analyzeGitHubRecords } from '../../lib/github/analyzer';
import { MAX_REPOS, parseRepo, splitRepoList } from '../../lib/github/repos';
import { useWorkspace } from '../../lib/workspace/store';

const demo: GitHubRecord[] = [
  { id: 'pr-142', type: 'pull_request', repository: 'example/arc-node', number: 142, title: 'Harden validator message validation', author: 'contributor', reviewers: ['maintainer-a', 'security-team'], state: 'closed', merged: true, commitSha: 'abc1234', baseBranch: 'main', headBranch: 'validator-validation', filesChanged: ['consensus/src/votes.rs', 'node/src/p2p.rs'], body: 'Validates identity, height, round and signature before state mutation.', comments: ['Security review requested before merge.'] },
  { id: 'issue-77', type: 'issue', repository: 'example/arc-node', number: 77, title: 'Replay protection discussion', author: 'researcher', state: 'closed', body: 'Discusses stale consensus messages and replay handling.' },
];

type TypeFilter = 'all' | GitHubRecord['type'];
interface RepoResult { repo: string; ok: boolean; count: number; error?: string }

export default function GitHubIntelligencePage() {
  const { state, setGithub } = useWorkspace();
  const synced = state.github;

  // Prefill from the repositories analysed in step 2, so both steps cover the same set.
  const analysisRepos = Array.from(new Set(state.analyses.map((a) => parseRepo(a.repository)).filter((r): r is string => Boolean(r)))).slice(0, MAX_REPOS);
  const defaultRepos = synced?.repos.length ? synced.repos : analysisRepos.length ? analysisRepos : [''];
  const [repoInputs, setRepoInputs] = useState<string[] | null>(null);
  const inputs = repoInputs ?? defaultRepos;
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<RepoResult[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [repoFilter, setRepoFilter] = useState<string>('all');

  const showingDemo = !synced;
  const records = synced?.records ?? demo;
  const repos = synced?.repos ?? ['example/arc-node'];
  const analysis = useMemo(() => analyzeGitHubRecords(repos.join(', '), records), [repos, records]);
  const types = useMemo(() => Array.from(new Set(records.map((r) => r.type))), [records]);
  const visible = records.filter((r) => (typeFilter === 'all' || r.type === typeFilter) && (repoFilter === 'all' || r.repository === repoFilter));

  const setInput = (i: number, value: string) => setRepoInputs(inputs.map((x, j) => (j === i ? value : x)));
  const addRow = () => { if (inputs.length < MAX_REPOS) setRepoInputs([...inputs, '']); };
  const removeRow = (i: number) => setRepoInputs(inputs.length > 1 ? inputs.filter((_, j) => j !== i) : ['']);

  // Pasting several repositories into one field spreads them across rows.
  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const parts = splitRepoList(e.clipboardData.getData('text'));
    if (parts.length < 2) return;
    e.preventDefault();
    const next = [...inputs.slice(0, i), ...parts, ...inputs.slice(i + 1)].filter((x, j, all) => x || all.length === 1);
    if (next.length > MAX_REPOS) setError(`Only the first ${MAX_REPOS} repositories were kept.`);
    setRepoInputs(next.slice(0, MAX_REPOS));
  };

  const filled = inputs.map((x) => x.trim()).filter(Boolean);

  async function sync() {
    const parsed = filled.map((x) => ({ raw: x, repo: parseRepo(x) }));
    const bad = parsed.find((p) => !p.repo);
    if (!parsed.length) { setError('Add at least one repository, for example circlefin/arc-node.'); return; }
    if (bad) { setError(`"${bad.raw}" isn't owner/repository. Use the form circlefin/arc-node or paste the GitHub URL.`); return; }
    const targets = Array.from(new Set(parsed.map((p) => p.repo as string)));
    setLoading(true); setError(''); setResults(null);
    try {
      const response = await fetch('/api/github/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repos: targets, token: token || undefined }) });
      const data = await response.json().catch(() => ({}));
      if (data.results) setResults(data.results);
      if (!response.ok) throw new Error(data.error || `GitHub sync failed (${response.status})`);
      const ok = (data.results as RepoResult[]).filter((r) => r.ok).map((r) => r.repo);
      const failures = (data.results as RepoResult[]).filter((r) => !r.ok).map((r) => ({ repo: r.repo, error: r.error ?? 'failed' }));
      setGithub({ repos: ok, records: data.records, syncedAt: new Date().toISOString(), failures });
      setRepoInputs(targets);
      setTypeFilter('all'); setRepoFilter('all');
    } catch (e) { setError(e instanceof Error ? e.message : 'GitHub sync failed'); }
    finally { setLoading(false); }
  }

  return <div>
    <PageHeader
      step="github"
      eyebrow="GitHub evidence"
      title="GitHub collaboration intelligence"
      description="Pull requests, reviews, comments and issues become research context: what changed, what the team discussed, and whether a suspected issue may already be known or fixed."
      aside={<span className="badge badge-green self-start md:self-auto">Read only</span>}
    />

    <form className="card card-p mt-8" onSubmit={(e) => { e.preventDefault(); sync(); }}>
      <div className="flex items-center justify-between gap-3">
        <span className="label">Repositories</span>
        <span className="text-xs text-gray-500">{filled.length}/{MAX_REPOS} · imported in parallel</span>
      </div>
      <ul className="mt-2 space-y-2">
        {inputs.map((value, i) => (
          <li key={i} className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setInput(i, e.target.value)}
              onPaste={(e) => onPaste(i, e)}
              placeholder={i === 0 ? 'owner/repository or GitHub URL' : 'another owner/repository'}
              aria-label={`Repository ${i + 1}`}
              className="input min-w-0 flex-1 font-normal"
            />
            {(inputs.length > 1 || value) && (
              <button type="button" onClick={() => removeRow(i)} aria-label={`Remove repository ${i + 1}`} className="btn btn-ghost btn-sm shrink-0">✕</button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={addRow} disabled={inputs.length >= MAX_REPOS} className="mt-2 text-xs text-gray-400 underline hover:text-white disabled:no-underline disabled:opacity-40">
        {inputs.length >= MAX_REPOS ? `Maximum ${MAX_REPOS} repositories` : '+ Add repository'}
      </button>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="label">GitHub token (optional)<input value={token} onChange={e => setToken(e.target.value)} placeholder="Raises rate limits, needed for private repos" type="password" autoComplete="off" className="input mt-1.5 font-normal" /></label>
        <button type="submit" disabled={loading || filled.length === 0} className="btn btn-primary self-end">
          {loading ? `Importing ${filled.length}…` : `Import ${filled.length || ''} ${filled.length === 1 ? 'repository' : 'repositories'}`.replace('  ', ' ')}
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">The token is sent once to this app&apos;s local server to call GitHub. It is never stored. Without a token GitHub allows 60 requests an hour, and each repository can use up to about 90, so use a token for multi-repository imports.</p>
      {error && <div className="mt-3"><Callout tone="danger" role="alert">{error}</Callout></div>}
      {results && (
        <ul className="mt-3 space-y-1 text-xs" aria-label="Import results">
          {results.map((r) => (
            <li key={r.repo} className="flex flex-wrap items-center gap-2">
              <span className={`badge ${r.ok ? 'badge-green' : 'badge-red'}`}>{r.ok ? 'imported' : 'failed'}</span>
              <span className="font-mono">{r.repo}</span>
              <span className="text-gray-500">{r.ok ? `${r.count} records` : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </form>

    <div className="mt-4">
      {showingDemo
        ? <Callout tone="warn">Showing built-in sample data. Import real repositories to replace it and mark this step complete.</Callout>
        : <Callout tone="ok"><span className="flex flex-wrap items-center justify-between gap-2"><span>Imported <span className="font-mono">{synced.repos.join(', ')}</span> · {synced.records.length} records · saved to workspace{synced.failures?.length ? ` · ${synced.failures.length} failed` : ''}</span><button type="button" onClick={() => { setGithub(null); setResults(null); }} className="text-xs underline">Remove</button></span></Callout>}
    </div>

    <section className="stat-grid mt-6">
      <Stat label="Records" value={analysis.records.length} hint={`${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}`} />
      <Stat label="Files touched" value={analysis.linkedAssets.length} />
      <Stat label="Research signals" value={analysis.knownIssueSignals.length} hint={analysis.knownIssueSignals.slice(0, 3).join(', ') || undefined} />
      <Stat label="Linked hypotheses" value={analysis.linkedHypotheses.length} />
    </section>

    <section className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="card overflow-hidden">
        <div className="space-y-2 border-b border-white/[.08] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Repository activity</h2>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
              {(['all', ...types] as TypeFilter[]).map((t) => (
                <button key={t} type="button" onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t} className={`rounded-full px-2.5 py-1 text-[11px] transition ${typeFilter === t ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5'}`}>{t.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
          {repos.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by repository">
              {['all', ...repos].map((r) => (
                <button key={r} type="button" onClick={() => setRepoFilter(r)} aria-pressed={repoFilter === r} className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition ${repoFilter === r ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5'}`}>{r === 'all' ? 'all repos' : r}</button>
              ))}
            </div>
          )}
        </div>
        {visible.length === 0
          ? <div className="p-4"><EmptyState title="No records" body="These repositories have no pull requests, or nothing matches the filter." /></div>
          : <ul className="max-h-[34rem] divide-y divide-white/5 overflow-auto">
            {visible.map(r => <li key={`${r.repository}-${r.type}-${r.id}`} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2"><span className="badge badge-blue">{r.type.replace('_', ' ')}</span>{repos.length > 1 && <span className="font-mono text-xs text-gray-400">{r.repository}</span>}{r.number && <span className="text-xs text-gray-500">#{r.number}</span>}<span className="text-xs text-gray-500">{r.author || 'unknown author'}</span>{r.merged && <span className="badge badge-green">merged</span>}</div>
              <p className="mt-1.5 text-sm font-medium">{r.title || r.body?.slice(0, 120) || 'Untitled record'}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                {r.commitSha && <span className="font-mono">commit {r.commitSha.slice(0, 12)}</span>}
                {r.filesChanged?.length ? <span>{r.filesChanged.length} file(s) changed</span> : null}
                {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-white">view on GitHub</a>}
              </p>
            </li>)}
          </ul>}
      </div>

      <div className="space-y-4">
        <div className="card card-p">
          <h2 className="h2">How Shakuni uses it</h2>
          <ul className="muted mt-3 space-y-2">
            <li>Map changed files to attack-surface components.</li>
            <li>Compare PR fixes against suspected hypotheses.</li>
            <li>Surface security discussions and review decisions.</li>
            <li>Flag likely known or duplicate issues without declaring a finding.</li>
            <li>Keep commit SHA and provenance in the evidence trail.</li>
          </ul>
        </div>
        <Callout tone="warn">GitHub discussion is context, not proof of a vulnerability. Runtime reproduction and invariant evaluation remain required.</Callout>
        {!synced && <Link href="/research" className="btn btn-ghost w-full">Skip to Research Registry</Link>}
      </div>
    </section>
  </div>;
}
