import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../lib/security/local-only";

/**
 * /api/github-search, prior-art / duplicate check against a repo's issues and
 * pull requests before you file a report. Uses GitHub's public search API
 * server-side. Unauthenticated (low rate limit); set GITHUB_TOKEN in the env to
 * raise it. Local only.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Item { number: number; title: string; url: string; state: string; isPr: boolean; createdAt: string }

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let b: { repo?: unknown; query?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 }); }

  const repo = typeof b.repo === "string" ? b.repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "") : "";
  const query = typeof b.query === "string" ? b.query.trim() : "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return NextResponse.json({ error: "repo must be owner/name." }, { status: 400 });
  if (!query) return NextResponse.json({ error: "query is required." }, { status: 400 });

  const q = encodeURIComponent(`repo:${repo} ${query}`);
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "Shakuni-Research" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=25&sort=created&order=desc`, { headers });
    if (!res.ok) {
      const txt = await res.text();
      const hint = res.status === 403 ? " (rate limited, set GITHUB_TOKEN to raise the limit)" : "";
      return NextResponse.json({ error: `GitHub ${res.status}${hint}`, detail: txt.slice(0, 200) }, { status: 200 });
    }
    const data = await res.json();
    const items: Item[] = (data.items ?? []).map((it: Record<string, unknown>) => ({
      number: it.number as number,
      title: it.title as string,
      url: it.html_url as string,
      state: it.state as string,
      isPr: Boolean(it.pull_request),
      createdAt: String(it.created_at ?? "").slice(0, 10),
    }));
    return NextResponse.json({ total: data.total_count ?? items.length, items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed." }, { status: 200 });
  }
}
