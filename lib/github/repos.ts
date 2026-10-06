/** Maximum repositories imported in one GitHub sync. */
export const MAX_REPOS = 5;

/**
 * Normalize "owner/repo", "https://github.com/owner/repo(.git)" or
 * "github.com/owner/repo/tree/main" to "owner/repo". Null if it isn't one.
 */
export function parseRepo(input: string): string | null {
  const s = input.trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
  const m = s.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Split pasted text (newlines, commas, spaces) into repository candidates. */
export function splitRepoList(text: string): string[] {
  return text.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}
