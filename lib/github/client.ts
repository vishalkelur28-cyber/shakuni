import type { GitHubRecord } from './types';

export async function fetchGitHubResearchContext(repo: string, token?: string): Promise<GitHubRecord[]> {
  const headers: HeadersInit = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = `https://api.github.com/repos/${repo}`;
  const pullRes = await fetch(`${base}/pulls?state=all&per_page=30`, { headers });
  if (!pullRes.ok) {
    if ((pullRes.status === 403 || pullRes.status === 429) && pullRes.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error(`GitHub rate limit reached${token ? '' : ' (60 requests/hour without a token, add one)'}.`);
    }
    if (pullRes.status === 404) throw new Error(`not found${token ? '' : ' (private repositories need a token)'}.`);
    throw new Error(`GitHub PR request failed: ${pullRes.status}`);
  }
  const pulls = await pullRes.json() as Array<any>;
  const records: GitHubRecord[] = [];
  for (const pr of pulls) {
    const [filesRes, reviewsRes, commentsRes] = await Promise.all([
      fetch(`${base}/pulls/${pr.number}/files?per_page=100`, { headers }),
      fetch(`${base}/pulls/${pr.number}/reviews?per_page=100`, { headers }),
      fetch(`${base}/issues/${pr.number}/comments?per_page=100`, { headers }),
    ]);
    const files = filesRes.ok ? await filesRes.json() : [];
    const reviews = reviewsRes.ok ? await reviewsRes.json() : [];
    const comments = commentsRes.ok ? await commentsRes.json() : [];
    records.push({ id: String(pr.id), type: 'pull_request', repository: repo, number: pr.number, title: pr.title, author: pr.user?.login, reviewers: reviews.map((r: any) => r.user?.login).filter(Boolean), state: pr.state, merged: Boolean(pr.merged_at), commitSha: pr.head?.sha, baseBranch: pr.base?.ref, headBranch: pr.head?.ref, filesChanged: files.map((f: any) => f.filename), body: pr.body ?? '', comments: [...reviews, ...comments].map((x: any) => x.body).filter(Boolean), createdAt: pr.created_at, updatedAt: pr.updated_at, sourceUrl: pr.html_url });
    for (const review of reviews) records.push({ id: String(review.id), type: 'review', repository: repo, number: pr.number, author: review.user?.login, state: review.state, commitSha: review.commit_id, body: review.body ?? '', createdAt: review.submitted_at, sourceUrl: review.html_url });
    for (const comment of comments) records.push({ id: String(comment.id), type: 'issue_comment', repository: repo, number: pr.number, author: comment.user?.login, body: comment.body ?? '', createdAt: comment.created_at, sourceUrl: comment.html_url });
  }
  return records;
}
