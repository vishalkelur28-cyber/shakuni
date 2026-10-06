export type AnalysisSource = "archsetu" | "generic";

export interface ExternalAnalysis {
  source: AnalysisSource;
  sourceUrl: string;
  repository: string;
  summary: {
    files?: number;
    functions?: number;
    deadCode?: number;
    entryPoints?: number;
    healthScore?: string;
    /** Language → share of files (%), when the source reports it. */
    languages?: Record<string, number>;
  };
  /** "link" = read from the report page by Shakuni; "pasted" = parsed from pasted text. */
  origin?: "link" | "pasted";
  details?: {
    description?: string | null;
    stars?: number | null;
    primaryLanguage?: string | null;
    analysisId?: string | null;
    completedAt?: string | null;
  };
  signals: string[];
  reusableForResearch: string[];
  limitations: string[];
  importedAt: string;
  /** The pasted report, kept so the import can be reviewed and re-run. */
  reportText?: string;
}
