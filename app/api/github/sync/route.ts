import { NextResponse } from 'next/server';
import { fetchGitHubResearchContext } from '../../../../lib/github/client';
import { MAX_REPOS, parseRepo } from '../../../../lib/github/repos';
import type { GitHubRecord } from '../../../../lib/github/types';

export interface RepoSyncResult {
  repo: string;
  ok: boolean;
  count: number;
  error?: string;
}

/**
 * POST { repos: string[] (1-5), token? } , also accepts the older { repo }.
 * Repositories are fetched in parallel; one failing doesn't sink the others.
 */
export async function POST(request: Request) {
  let body: { repos?: unknown; repo?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const raw = Array.isArray(body.repos) ? body.repos : typeof body.repo === 'string' ? [body.repo] : [];
  const repos: string[] = [];
  for (const item of raw) {
    const repo = typeof item === 'string' ? parseRepo(item) : null;
    if (!repo) return NextResponse.json({ error: `"${String(item)}" is not an owner/repository.` }, { status: 400 });
    if (!repos.some((r) => r.toLowerCase() === repo.toLowerCase())) repos.push(repo);
  }
  if (repos.length === 0) return NextResponse.json({ error: 'Add at least one repository in owner/repository format.' }, { status: 400 });
  if (repos.length > MAX_REPOS) return NextResponse.json({ error: `At most ${MAX_REPOS} repositories per import.` }, { status: 400 });

  const token = typeof body.token === 'string' && body.token ? body.token : undefined;
  const settled = await Promise.allSettled(repos.map((repo) => fetchGitHubResearchContext(repo, token)));

  const records: GitHubRecord[] = [];
  const results: RepoSyncResult[] = repos.map((repo, i) => {
    const s = settled[i];
    if (s.status === 'fulfilled') {
      records.push(...s.value);
      return { repo, ok: true, count: s.value.length };
    }
    return { repo, ok: false, count: 0, error: s.reason instanceof Error ? s.reason.message : 'Unable to sync.' };
  });

  if (!results.some((r) => r.ok)) {
    return NextResponse.json({ error: `All ${repos.length} repositories failed. ${results.map((r) => `${r.repo}: ${r.error}`).join('; ')}`, results }, { status: 502 });
  }
  return NextResponse.json({ records, results });
}
