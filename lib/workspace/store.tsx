"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BountyProgramProfile } from "../bug-bounty/types";
import type { ExternalAnalysis } from "../external-analysis/types";
import type { GitHubRecord } from "../github/types";

/**
 * Cross-page research workspace. Each workflow step writes its result here so
 * later steps (and the sidebar) can see what has actually been completed.
 * Persisted to localStorage only; nothing leaves the browser except an explicit
 * GitHub sync request.
 */
export interface WorkspaceState {
  program: BountyProgramProfile | null;
  /** Imported repository analyses (up to 5), one per repository. */
  analyses: ExternalAnalysis[];
  github: GitHubWorkspace | null;
}

export interface GitHubWorkspace {
  /** Repositories in this import (up to 5), in the order they were entered. */
  repos: string[];
  records: GitHubRecord[];
  syncedAt: string;
  /** Repositories that failed in the last import, with the reason. */
  failures?: { repo: string; error: string }[];
}

/** Older saves held a single `analysis` and a single GitHub `repo`; lift them into lists. */
function migrate(raw: Partial<WorkspaceState> & { analysis?: ExternalAnalysis | null; github?: (Partial<GitHubWorkspace> & { repo?: string }) | null }): WorkspaceState {
  const { analysis, ...rest } = raw;
  const analyses = Array.isArray(rest.analyses) ? rest.analyses : analysis ? [analysis] : [];
  const g = raw.github;
  const github = g && Array.isArray(g.records)
    ? { repos: Array.isArray(g.repos) ? g.repos : g.repo ? [g.repo] : [], records: g.records, syncedAt: g.syncedAt ?? "", failures: g.failures }
    : null;
  return { ...EMPTY, ...rest, analyses, github } as WorkspaceState;
}

const EMPTY: WorkspaceState = { program: null, analyses: [], github: null };
const KEY = "shakuni.workspace.v1";

interface WorkspaceApi {
  state: WorkspaceState;
  /** False until localStorage has been read, so pages can avoid flashing empty state. */
  ready: boolean;
  setProgram: (p: BountyProgramProfile | null) => void;
  setAnalyses: (a: ExternalAnalysis[]) => void;
  setGithub: (g: WorkspaceState["github"]) => void;
  reset: () => void;
}

const Ctx = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setState(migrate(JSON.parse(raw)));
    } catch {
      /* storage blocked or corrupt: start empty */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or blocked: keep in-memory state */
    }
  }, [state, ready]);

  const setProgram = useCallback((program: BountyProgramProfile | null) => setState((s) => ({ ...s, program })), []);
  const setAnalyses = useCallback((analyses: ExternalAnalysis[]) => setState((s) => ({ ...s, analyses })), []);
  const setGithub = useCallback((github: WorkspaceState["github"]) => setState((s) => ({ ...s, github })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  const api = useMemo(() => ({ state, ready, setProgram, setAnalyses, setGithub, reset }), [state, ready, setProgram, setAnalyses, setGithub, reset]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return v;
}
