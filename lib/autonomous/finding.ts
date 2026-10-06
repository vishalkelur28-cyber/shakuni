import type { CausalControl, ReplayResult } from "./prove.ts";
import type { ImpactReport, Violation } from "./target.ts";

/**
 * Autonomous status ladder. The hunter can reach REPRODUCED on its own; only a
 * human review (in Shakuni's confirmation gate) may promote to CONFIRMED.
 */
export type AutoStatus = "DISPROVEN" | "YELLOW" | "GREEN_SYNTHETIC";

export interface AutoFinding {
  targetId: string;
  targetName: string;
  status: AutoStatus;
  violation: Violation | null;
  discoveryPath: string[];
  minimalPath: string[];
  necessarySteps: string[];
  causalControls: CausalControl[];
  replays: ReplayResult[];
  impact: ImpactReport | null;
  /** Why the gate landed where it did, every unmet requirement, in plain English. */
  gateReasons: string[];
  stats: { examined: number; pruned: number; unique: number; depthReached: number };
  createdAt: string;
}
