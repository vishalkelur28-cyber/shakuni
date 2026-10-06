import { parseRepo } from "../github/repos";
import type { ExternalAnalysis } from "./types";

const numberAfter = (text: string, pattern: RegExp) => {
  const m = text.match(pattern);
  return m ? Number(m[1].replace(/,/g, "")) : undefined;
};

/** Canonical ArchSetu report URL for a repository. */
export const archSetuUrl = (repo: string) => `https://www.archsetu.com/r/${repo}`;

/** Repository named by an ArchSetu report URL, a GitHub URL, or plain "owner/repo". */
export function repoFromLink(link: string): string | null {
  const s = link.trim();
  const archsetu = s.match(/archsetu\.com\/r\/([\w.-]+\/[\w.-]+)/i)?.[1];
  return archsetu ? parseRepo(archsetu) : parseRepo(s);
}

/** Parse a pasted report summary (fallback when the report link can't be read). */
export function importArchSetuAnalysis(sourceUrl: string, reportText: string): ExternalAnalysis {
  // Which repository: "Analysis: owner/repo", an ArchSetu …/r/owner/repo URL,
  // a leading "owner/repo" in the report, or a GitHub URL.
  const repository =
    reportText.match(/(?:Analysis|report)\s*[:\-]?\s*([\w.-]+\/[\w.-]+)/i)?.[1] ??
    sourceUrl.match(/\/r\/([^/]+\/[^/?#]+)/)?.[1] ??
    reportText.match(/^\s*([\w.-]+\/[\w.-]+)(?=[\s:]|$)/)?.[1] ??
    (/github\.com\//i.test(sourceUrl) ? parseRepo(sourceUrl) : null) ??
    "Unknown repository";
  const health = reportText.match(/\b(\d{1,3})\s*(?:\/\s*100)?\s+([A-F][+-]?)(?=\s|$)/);

  return buildArchSetuAnalysis({
    sourceUrl,
    repository,
    origin: "pasted",
    reportText,
    summary: {
      files: numberAfter(reportText, /([\d,]+)\s+files?/i),
      functions: numberAfter(reportText, /([\d,]+)\s+functions?/i),
      deadCode: numberAfter(reportText, /([\d,]+)\s+dead\s+code/i),
      entryPoints: numberAfter(reportText, /([\d,]+)\s+entry\s+points?/i),
      healthScore: health ? `${health[1]} ${health[2]}` : undefined,
    },
  });
}

/** Shared shape for an ArchSetu analysis, whether read from the report link or pasted. */
export function buildArchSetuAnalysis(input: Pick<ExternalAnalysis, "sourceUrl" | "repository" | "summary" | "origin" | "details" | "reportText">): ExternalAnalysis {
  return {
    source: "archsetu",
    ...input,
    signals: [
      "Call graph / function structure already analyzed",
      "Dead-code candidates available as static signals",
      "Entry points identified by the upstream analysis",
      "Repository structure and ownership/history can be used as research context",
    ],
    reusableForResearch: [
      "Seed Shakuni's repository map without repeating baseline structural analysis",
      "Prioritize entry points and high-connectivity functions for security review",
      "Cross-reference suspected paths with GitHub PRs, issues, reviews and commits",
      "Use dead-code and blast-radius signals to prioritize investigation, not as proof of a vulnerability",
      "Carry the upstream commit/report provenance into the eventual evidence chain",
    ],
    limitations: [
      "Static analysis is evidence for investigation, not proof of exploitability",
      "Shakuni must independently validate security invariants and runtime behavior",
      "The imported report must be tied to an exact repository state/commit before treating it as reproducible evidence",
    ],
    importedAt: new Date().toISOString(),
  };
}
