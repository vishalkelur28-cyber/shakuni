import { archSetuUrl, buildArchSetuAnalysis } from "./archsetu";
import type { ExternalAnalysis } from "./types";

/**
 * Read an ArchSetu report straight from its public page. Server-only.
 *
 * The report page (/r/owner/repo) server-renders the analysis summary into
 * its React Server Components payload (`self.__next_f.push([1,"…"])`). We
 * decode those chunks and read the `summary` props, the same numbers the page
 * shows, instead of scraping visible text (whose health ring animates from 0).
 * Only www.archsetu.com is ever fetched; the URL is rebuilt from owner/repo.
 */

const TIMEOUT_MS = 30_000;

export class ArchSetuLinkError extends Error {}

interface ReportSummary {
  healthScore: number | null;
  grade: string | null;
  totalFunctions: number;
  deadCodeCount: number;
  entryPointCount: number;
  totalFiles: number;
  languageBreakdown?: Record<string, number>;
}

/** Concatenate and unescape every RSC payload chunk in the page. */
function rscPayload(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { parts.push(JSON.parse(m[1]) as string); } catch { /* skip malformed chunk */ }
  }
  return parts.join("");
}

/** Read the JSON value that follows the first `"key":` in the payload. */
function jsonValueAfter(payload: string, key: string): unknown {
  const marker = `"${key}":`;
  const start = payload.indexOf(marker);
  if (start < 0) return undefined;
  let i = start + marker.length;
  const first = payload[i];
  if (first !== "{" && first !== "[" && first !== '"') {
    const m = payload.slice(i).match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null)/);
    return m ? JSON.parse(m[1]) : undefined;
  }
  let depth = 0;
  let inString = false;
  for (let j = i; j < payload.length; j++) {
    const c = payload[j];
    if (inString) {
      if (c === "\\") j++;
      else if (c === '"') { inString = false; if (depth === 0) return JSON.parse(payload.slice(i, j + 1)); }
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(payload.slice(i, j + 1)); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

export async function fetchArchSetuAnalysis(repo: string): Promise<ExternalAnalysis> {
  const url = archSetuUrl(repo);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Shakuni/1.0 (local research tool)", Accept: "text/html" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new ArchSetuLinkError(e instanceof Error && e.name === "TimeoutError" ? "ArchSetu didn't respond in 30s." : "Couldn't reach ArchSetu.");
  }
  if (res.status === 404) throw new ArchSetuLinkError("ArchSetu has no page for this repository.");
  if (!res.ok) throw new ArchSetuLinkError(`ArchSetu returned ${res.status}.`);

  const payload = rscPayload(await res.text());
  if (!payload) throw new ArchSetuLinkError("Couldn't read the ArchSetu report page (format changed?). Paste the report text instead.");

  const status = jsonValueAfter(payload, "analysisStatus") as string | null | undefined;
  const analysisId = jsonValueAfter(payload, "analysisId") as string | null | undefined;
  if (!analysisId) throw new ArchSetuLinkError("ArchSetu hasn't analysed this repository yet. Open the link to start an analysis, then fetch again.");
  if (status !== "complete") {
    const err = jsonValueAfter(payload, "initialErrorMessage") as string | null | undefined;
    throw new ArchSetuLinkError(`ArchSetu analysis is ${status ?? "not finished"}${err ? `: ${err}` : ""}. Fetch again once it completes.`);
  }

  const summary = jsonValueAfter(payload, "summary") as ReportSummary | undefined;
  if (!summary || typeof summary.totalFunctions !== "number") {
    throw new ArchSetuLinkError("The ArchSetu page had no readable summary. Paste the report text instead.");
  }

  const languages = Object.fromEntries(Object.entries(summary.languageBreakdown ?? {}).filter(([, v]) => typeof v === "number" && v > 0));
  return buildArchSetuAnalysis({
    sourceUrl: url,
    repository: (jsonValueAfter(payload, "fullName") as string | undefined) ?? repo,
    origin: "link",
    summary: {
      files: summary.totalFiles,
      functions: summary.totalFunctions,
      deadCode: summary.deadCodeCount,
      entryPoints: summary.entryPointCount,
      healthScore: summary.healthScore === null ? undefined : `${summary.healthScore} ${summary.grade ?? ""}`.trim(),
      languages: Object.keys(languages).length ? languages : undefined,
    },
    details: {
      description: jsonValueAfter(payload, "description") as string | null | undefined,
      stars: jsonValueAfter(payload, "stars") as number | null | undefined,
      primaryLanguage: jsonValueAfter(payload, "primaryLanguage") as string | null | undefined,
      analysisId,
      completedAt: jsonValueAfter(payload, "completedAt") as string | null | undefined,
    },
  });
}
