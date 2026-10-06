import type { Abstraction, ImpactReport, Target, Violation } from "./target.ts";

/**
 * Synthetic benchmark protocol (ported from CHEETA's protocol.py).
 *
 * A fake multi-subsystem protocol with a deliberately hidden cross-layer
 * finality/settlement safety failure. It exists to prove the hunter can go
 * from "I don't know the bug" to a minimal, causally-validated, replayed,
 * impact-measured reproduction, WITHOUT being told the answer.
 *
 * The hidden defect lives only in `finalize`. The hunter is given the generic
 * invariants below and the action list; it is NOT given the required
 * conditions or the sequence. Ground truth lives in ground-truth.ts, which the
 * engine never imports.
 */

export interface SynthState {
  epoch: number;
  height: number;
  live_root: number;
  settlement_root: number;
  finality_root: number;
  pending: number;
  pending_claim: number;
  delivered: number;
  user_balance: number;
  protocol_assets: number;
  reserve: number;
  total_supply: number;
  user_power: number;
  quorum: number;
  emergency: boolean;
  settlement_nonce: number;
  finality_nonce: number;
  reward_index: number;
  reward_pool: number;
  claimed: number;
  finalized: number;
  paused: boolean;
  bridge_nonce: number;
  bridge_pending: number;
  oracle_epoch: number;
  oracle_price: number;
  debt: number;
  fee_pool: number;
  checkpoint: number;
  [k: string]: number | boolean | string;
}

const INITIAL: SynthState = {
  epoch: 1, height: 100, live_root: 111, settlement_root: 111, finality_root: 111,
  pending: 0, pending_claim: 0, delivered: 0,
  user_balance: 1000, protocol_assets: 1_000_000, reserve: 1_000_000, total_supply: 1_000_000,
  user_power: 10, quorum: 7, emergency: false,
  settlement_nonce: 0, finality_nonce: 0,
  reward_index: 1_000_000, reward_pool: 10_000, claimed: 0, finalized: 0, paused: false,
  bridge_nonce: 0, bridge_pending: 0, oracle_epoch: 1, oracle_price: 100,
  debt: 0, fee_pool: 0, checkpoint: 0,
};

const ACTIONS = [
  "observe", "deposit", "small_deposit", "queue_claim", "cancel_claim",
  "deliver_message", "partial_deliver", "advance_epoch", "advance_epoch_small",
  "rotate_authority", "rotate_authority_again", "enter_emergency", "exit_emergency",
  "accrue_rewards", "accrue_small_reward", "claim_rewards", "rebase",
  "roll_settlement_nonce", "roll_finality_nonce", "sync_settlement_root", "sync_finality_root",
  "finalize", "checkpoint", "checkpoint_again", "bridge_open", "bridge_close",
  "bridge_tick", "oracle_tick", "oracle_refresh", "fee_sweep", "pause", "unpause",
] as const;

const SUBSYSTEM: Record<string, string> = {
  deposit: "econ", small_deposit: "econ", accrue_rewards: "econ", accrue_small_reward: "econ",
  claim_rewards: "econ", rebase: "econ", fee_sweep: "econ",
  queue_claim: "settle", cancel_claim: "settle", deliver_message: "settle", partial_deliver: "settle",
  roll_settlement_nonce: "settle", sync_settlement_root: "settle",
  finalize: "finality", roll_finality_nonce: "finality", sync_finality_root: "finality",
  checkpoint: "finality", checkpoint_again: "finality",
  advance_epoch: "time", advance_epoch_small: "time", oracle_tick: "time", oracle_refresh: "time",
  rotate_authority: "authority", rotate_authority_again: "authority",
  enter_emergency: "authority", exit_emergency: "authority", pause: "authority", unpause: "authority",
  bridge_open: "bridge", bridge_close: "bridge", bridge_tick: "bridge",
};

function apply(s0: SynthState, a: string): SynthState {
  const s: SynthState = { ...s0 };
  switch (a) {
    case "observe": break;
    case "deposit": s.user_balance += 100; s.protocol_assets += 100; s.total_supply += 100; break;
    case "small_deposit": s.user_balance += 1; s.protocol_assets += 1; s.total_supply += 1; break;
    case "queue_claim":
      if (!s.paused && s.user_balance >= 100) { s.user_balance -= 100; s.pending += 100; s.pending_claim += 100; s.settlement_nonce += 1; }
      break;
    case "cancel_claim":
      if (s.pending_claim >= 100) { s.pending_claim -= 100; s.pending -= 100; s.user_balance += 100; }
      break;
    case "deliver_message": if (s.pending > 0) { s.delivered += s.pending; s.pending = 0; } break;
    case "partial_deliver": if (s.pending >= 50) { s.delivered += 50; s.pending -= 50; } break;
    case "advance_epoch": s.epoch += 1; s.height += 100; s.settlement_root = s.live_root; s.oracle_epoch = s.epoch; break;
    case "advance_epoch_small": s.epoch += 1; s.height += 1; break;
    case "rotate_authority": s.live_root = 1000 + s.epoch * 17 + s.height; break;
    case "rotate_authority_again": s.live_root = 2000 + s.epoch * 19 + s.height; break;
    case "enter_emergency": s.emergency = true; s.quorum = 5; break;
    case "exit_emergency": s.emergency = false; s.quorum = 7; break;
    case "accrue_rewards": s.reward_pool += 1000; s.reward_index += 10; break;
    case "accrue_small_reward": s.reward_pool += 10; s.reward_index += 1; break;
    case "claim_rewards": if (s.reward_pool >= 1000) { s.reward_pool -= 1000; s.claimed += 1000; s.user_balance += 1000; } break;
    case "rebase": s.total_supply = Math.floor(s.total_supply * 1.0); break;
    case "roll_settlement_nonce": s.settlement_nonce += 1; break;
    case "roll_finality_nonce": s.finality_nonce += 1; break;
    case "sync_settlement_root": s.settlement_root = s.live_root; break;
    case "sync_finality_root": s.finality_root = s.live_root; break;
    case "finalize":
      // Hidden defect: finalizes using settlement_root even when authority has
      // drifted (settlement_root != live_root), under a specific conjunction.
      if (s.emergency && s.pending_claim > 0
        && s.settlement_nonce !== s.finality_nonce
        && s.settlement_root !== s.live_root
        && s.oracle_epoch !== s.epoch) {
        s.finalized += 1;
        s.finality_root = s.settlement_root;
      }
      break;
    case "checkpoint": s.checkpoint = s.height; break;
    case "checkpoint_again": s.checkpoint = s.height + 1; break;
    case "bridge_open": s.bridge_pending += 1; s.bridge_nonce += 1; break;
    case "bridge_close": if (s.bridge_pending > 0) s.bridge_pending -= 1; break;
    case "bridge_tick": s.bridge_nonce += 1; break;
    case "oracle_tick": s.oracle_price += 1; break;
    case "oracle_refresh": s.oracle_epoch = s.epoch; break;
    case "fee_sweep": s.fee_pool += 10; break;
    case "pause": s.paused = true; break;
    case "unpause": s.paused = false; break;
    default: break;
  }
  return s;
}

function abstract(s: SynthState): Abstraction {
  return [
    s.epoch,
    s.live_root,
    s.settlement_root,
    s.finality_root,
    s.pending_claim > 0,
    s.emergency,
    s.settlement_nonce !== s.finality_nonce,
    s.oracle_epoch !== s.epoch,
    s.finalized > 0,
    s.paused,
    s.bridge_pending > 0,
  ];
}

function invariants(before: SynthState, after: SynthState): Violation[] {
  const bad: Violation[] = [];
  // Generic, not bug-specific: finalization must keep finality consistent with the live authority root.
  if (after.finalized > before.finalized && after.finality_root !== after.live_root) {
    bad.push({ id: "finality_preserves_authority_consistency", detail: "finalized advanced while finality_root != live_root" });
  }
  // Generic conservation checks (never violated here; present so the hunter isn't tuned to one rule).
  if (after.total_supply < 0 || after.reserve < 0 || after.protocol_assets < 0) {
    bad.push({ id: "nonnegative_balances", detail: "a core balance went negative" });
  }
  if (after.finality_nonce < before.finality_nonce || after.settlement_nonce < before.settlement_nonce) {
    bad.push({ id: "nonce_monotonic", detail: "a nonce decreased" });
  }
  return bad;
}

function impact(start: SynthState, end: SynthState): ImpactReport {
  const real = end.finalized > start.finalized && end.finality_root !== end.live_root && end.pending_claim > 0;
  return {
    real,
    deltas: {
      finalized: end.finalized - start.finalized,
      finality_root: end.finality_root,
      live_root: end.live_root,
      authority_gap: end.live_root - end.finality_root,
      pending_claim: end.pending_claim,
    },
    summary: real
      ? `Finalized ${end.finalized - start.finalized} claim(s) against authority root ${end.finality_root} while the live authority root is ${end.live_root} (gap ${end.live_root - end.finality_root}), with ${end.pending_claim} still pending.`
      : "No finalized-against-stale-authority transition observed.",
  };
}

export function createSyntheticTarget(): Target<SynthState> {
  return {
    id: "synthetic-cheeta-v1",
    name: "Synthetic cross-layer finality benchmark",
    reset: () => ({ ...INITIAL }),
    actions: () => ACTIONS,
    apply,
    abstract,
    invariants,
    impact,
    subsystemOf: (a) => SUBSYSTEM[a] ?? null,
  };
}
