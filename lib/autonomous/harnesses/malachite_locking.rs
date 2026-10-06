//! Shakuni autonomous property harness — runs against the REAL Driver.
//!
//! Lead (malachite): "Locked-value / valid-value inconsistency across rounds"
//! (the Tendermint locking rule).
//!
//! Core locking-safety invariant: the driver must NEVER emit a precommit for a
//! non-nil value `v` in round `r` unless a genuine polka — a 2/3 prevote quorum
//! for `v` in round `r` — actually formed. A precommit without a backing polka
//! means the locking/round-change logic let a value through unlocked, a safety break.
//!
//! Method: feed the real driver randomized sequences of proposals and prevotes
//! (partial, mixed-value, cross-round). Independently tally every prevote in the
//! system (fed + the driver's own emitted prevote), and whenever the driver
//! emits a precommit for `v` in round `r`, assert our independent prevote power
//! for `(r, v)` meets the 2/3 quorum.
//!
//! HELD = "could not break it"; BROKEN = reproducible seed.

use std::collections::BTreeMap;

use malachitebft_core_types::{NilOrVal, Round, SignedProposal, SignedVote, Validity, Vote as _, VoteType};

use arc_malachitebft_core_driver::{Driver, Input, Output};
use malachitebft_test::{
    Address, Height, PrivateKey, Proposal, Signature, TestContext, Validator, ValidatorSet, Value, ValueId, Vote,
};

const H: u64 = 1;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: u64) -> u64 { self.next() % n }
}

type Tally = BTreeMap<(u32, usize), ValueId>;

fn power_for(prevotes: &Tally, round: u32, id: ValueId) -> u64 {
    prevotes.iter().filter(|((r, _), &v)| *r == round && v == id).count() as u64
}

fn proposal_input(round: Round, value: Value, proposer: Address) -> Input<TestContext> {
    let p = Proposal::new(Height::new(H), round, value, Round::Nil, proposer);
    Input::Proposal(SignedProposal::new(p, Signature::test()), Validity::Valid)
}
fn prevote_input(round: Round, value: Value, addr: Address) -> Input<TestContext> {
    Input::Vote(SignedVote::new(Vote::new_prevote(Height::new(H), round, NilOrVal::Val(value.id()), addr), Signature::test()))
}

struct Counterexample {
    seed: u64,
    detail: String,
}

/// Process one input; record the driver's own prevote and check any driver precommit is polka-backed.
fn step(
    driver: &mut Driver<TestContext>,
    input: Input<TestContext>,
    addrs: &[Address],
    total: u64,
    prevotes: &mut Tally,
    driver_precommits: &mut u64,
) -> Result<(), String> {
    for o in driver.process(input).unwrap_or_default() {
        let Output::Vote(v) = o else { continue };
        let Some(vi) = addrs.iter().position(|x| x == v.validator_address()) else { continue };
        let round = v.round().as_u32().unwrap_or(0);
        match v.vote_type() {
            VoteType::Prevote => {
                if let NilOrVal::Val(id) = v.value() {
                    prevotes.entry((round, vi)).or_insert(*id);
                }
            }
            VoteType::Precommit => {
                if vi == 0 {
                    if let NilOrVal::Val(id) = v.value() {
                        let p = power_for(prevotes, round, *id);
                        if !(p.saturating_mul(3) > total.saturating_mul(2)) {
                            return Err(format!("driver precommitted {:?} in round {} with only {}/{} prevote power — no polka (locking rule violated)", id, round, p, total));
                        }
                        *driver_precommits += 1;
                    }
                }
            }
        }
    }
    Ok(())
}

fn run_one(seed: u64) -> Result<u64, Counterexample> {
    let mut rng = Rng(seed);
    let n = 4 + (rng.below(4) as usize); // 4..=7 validators, power 1 each
    let total = n as u64;

    let mut addrs = Vec::with_capacity(n);
    let mut vals = Vec::with_capacity(n);
    for i in 0..n {
        let pk = PrivateKey::from([i as u8 + 1; 32]);
        addrs.push(Address::from_public_key(&pk.public_key()));
        vals.push(Validator::new(pk.public_key(), 1));
    }
    let ctx = TestContext::new();
    let mut driver = Driver::new(ctx, Height::new(H), ValidatorSet::new(vals), addrs[0], Default::default());

    let values = [Value::new(0xA), Value::new(0xB), Value::new(0xC)];
    let mut prevotes: Tally = BTreeMap::new();
    let mut driver_precommits: u64 = 0;

    let rounds = 1 + rng.below(4); // 1..=4 rounds
    for r in 0..rounds as u32 {
        let proposer = addrs[rng.below(n as u64) as usize];
        let value = values[rng.below(values.len() as u64) as usize].clone();
        step(&mut driver, Input::NewRound(Height::new(H), Round::new(r), proposer), &addrs, total, &mut prevotes, &mut driver_precommits).map_err(|d| Counterexample { seed, detail: d })?;
        step(&mut driver, proposal_input(Round::new(r), value.clone(), proposer), &addrs, total, &mut prevotes, &mut driver_precommits).map_err(|d| Counterexample { seed, detail: d })?;
        let events = 1 + rng.below((2 * n) as u64) as usize;
        for _ in 0..events {
            let vi = rng.below(n as u64) as usize;
            let pv = values[rng.below(values.len() as u64) as usize].clone();
            prevotes.entry((r, vi)).or_insert(pv.id());
            step(&mut driver, prevote_input(Round::new(r), pv, addrs[vi]), &addrs, total, &mut prevotes, &mut driver_precommits).map_err(|d| Counterexample { seed, detail: d })?;
        }
    }

    Ok(driver_precommits)
}

#[test]
fn shakuni_precommit_requires_polka() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(30_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0x10CC);

    let mut total_precommits: u64 = 0;
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        match run_one(seed) {
            Ok(p) => total_precommits += p,
            Err(ce) => panic!("LOCKING VIOLATION: {} seed={}", ce.detail, ce.seed),
        }
    }

    println!("SHAKUNI_PROPERTY name=precommit_requires_polka iters={} quorums_verified={} violations=0 result=HELD", iters, total_precommits);
    assert!(total_precommits > 0, "harness never observed a driver precommit — property is vacuous");
}
