import type { GitHubRecord, GitHubResearchContext } from './types';

const signalWords = ['security', 'vulnerability', 'bug', 'fix', 'auth', 'permission', 'access', 'consensus', 'signature', 'replay', 'cctp', 'usdc', 'gateway'];

export function analyzeGitHubRecords(repository: string, records: GitHubRecord[]): GitHubResearchContext {
  const text = records.map(r => [r.title, r.body, ...(r.comments ?? [])].filter(Boolean).join(' ')).join(' ').toLowerCase();
  const knownIssueSignals = signalWords.filter(word => text.includes(word));
  const linkedAssets = [...new Set(records.flatMap(r => r.filesChanged ?? []))];
  const linkedHypotheses = records.filter(r => /security|vulnerability|bug|fix|permission|auth/i.test(`${r.title ?? ''} ${r.body ?? ''}`)).map(r => `${r.type}:${r.number ?? r.id}`);
  return { repository, records, linkedAssets, linkedHypotheses, knownIssueSignals, provenance: { fetchedAt: new Date().toISOString(), apiVersion: 'GitHub REST API', authenticated: false } };
}
