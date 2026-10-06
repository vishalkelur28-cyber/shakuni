import { NextResponse } from "next/server";
import { repoFromLink } from "../../../../lib/external-analysis/archsetu";
import { ArchSetuLinkError, fetchArchSetuAnalysis } from "../../../../lib/external-analysis/archsetu-link";
import type { ExternalAnalysis } from "../../../../lib/external-analysis/types";
import { MAX_REPOS } from "../../../../lib/github/repos";

/**
 * POST { links: string[] (1-5) } , ArchSetu report URLs, GitHub URLs or owner/repo.
 * Reads each repository's ArchSetu report in parallel. One failing doesn't sink the others.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LinkResult {
  link: string;
  repo: string | null;
  ok: boolean;
  analysis?: ExternalAnalysis;
  error?: string;
}

export async function POST(request: Request) {
  let body: { links?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const links = Array.isArray(body.links) ? body.links.filter((l): l is string => typeof l === "string" && Boolean(l.trim())) : [];
  if (!links.length) return NextResponse.json({ error: "Add at least one report link." }, { status: 400 });
  if (links.length > MAX_REPOS) return NextResponse.json({ error: `At most ${MAX_REPOS} repositories at once.` }, { status: 400 });

  const results: LinkResult[] = await Promise.all(links.map(async (link): Promise<LinkResult> => {
    const repo = repoFromLink(link);
    if (!repo) return { link, repo: null, ok: false, error: "Not an ArchSetu report link, GitHub URL or owner/repo." };
    try {
      return { link, repo, ok: true, analysis: await fetchArchSetuAnalysis(repo) };
    } catch (e) {
      return { link, repo, ok: false, error: e instanceof ArchSetuLinkError ? e.message : "Failed to read the ArchSetu report." };
    }
  }));
  return NextResponse.json({ results });
}
