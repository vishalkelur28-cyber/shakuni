export type GitHubRecordType = 'pull_request' | 'issue' | 'review' | 'review_comment' | 'commit' | 'issue_comment';

export interface GitHubRecord {
  id: string;
  type: GitHubRecordType;
  repository: string;
  number?: number;
  title?: string;
  author?: string;
  reviewers?: string[];
  state?: string;
  merged?: boolean;
  commitSha?: string;
  baseBranch?: string;
  headBranch?: string;
  filesChanged?: string[];
  body?: string;
  comments?: string[];
  createdAt?: string;
  updatedAt?: string;
  sourceUrl?: string;
}

export interface GitHubResearchContext {
  repository: string;
  records: GitHubRecord[];
  linkedAssets: string[];
  linkedHypotheses: string[];
  knownIssueSignals: string[];
  provenance: { fetchedAt: string; apiVersion: string; authenticated: boolean };
}
