//! Shakuni autonomous property harness — runs against the REAL Driver.
//!
//! Lead (malachite): "Two distinct values decided at the same height
//! (agreement break)" — the core BFT safety property.
//!
//! Method: build a real `Driver` (one validator's view) and feed it randomized,
//! protocol-shaped sequences that try to complete precommit quorums for
//! DIFFERENT values across different rounds (i.e. a Byzantine environment where
//! voters sign conflicting values in different rounds). Collect every
//! `Output::Decide` the driver emits for the height, and assert the set of
//! decided values has size <= 1. A run where the driver decides two different
//! values is a real agreement (safety) break.
//!
//! This is real execution of in-scope code. A HELD result means "could not
//! break it" — the honest outcome; a BROKEN result carries a reproducible seed.

use malachitebft_core_types::{NilOrVal, Proposal as _, Round, SignedProposal, SignedVote, Validity};

use arc_malachitebft_core_driver::{Driver, Input, Output};
use malachitebft_test::{
    Address, Height, PrivateKey, Proposal, Signature, TestContext, Validator, ValidatorSet, Value, Vote,
};

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

const H: u64 = 1;

fn proposal_input(round: Round, value: Value, proposer: Address) -> Input<TestContext> {
    let p = Proposal::new(Height::new(H), round, value, Round::Nil, proposer);
    Input::Proposal(SignedProposal::new(p, Signature::test()), Validity::Valid)
}
fn prevote_input(round: Round, value: Value, addr: Address) -> Input<TestContext> {
    Input::Vote(SignedVote::new(Vote::new_prevote(Height::new(H), round, NilOrVal::Val(value.id()), addr), Signature::test()))
}
fn precommit_input(round: Round, value: Value, addr: Address) -> Input<TestContext> {
    Input::Vote(SignedVote::new(Vote::new_precommit(Height::new(H), round, NilOrVal::Val(value.id()), addr), Signature::test()))
}

fn feed(driver: &mut Driver<TestContext>, input: Input<TestContext>, decided: &mut Vec<Value>) {
    if let Ok(outputs) = driver.process(input) {
        for o in outputs {
            if let Output::Decide(_, p) = o {
                decided.push(p.value().clone());
            }
        }
    }
}

/// Attempt a full honest decide for `value` in `round`: NewRound -> Proposal ->
/// a quorum of prevotes -> a quorum of precommits. Errors are ignored (the
/// driver may already have moved on); any Decide emitted is recorded.
fn drive_decision(
    driver: &mut Driver<TestContext>,
    round: Round,
    proposer: Address,
    value: Value,
    others: &[Address],
    decided: &mut Vec<Value>,
) {
    feed(driver, Input::NewRound(Height::new(H), round, proposer), decided);
    feed(driver, proposal_input(round, value.clone(), proposer), decided);
    for &a in others {
        feed(driver, prevote_input(round, value.clone(), a), decided);
    }
    for &a in others {
        feed(driver, precommit_input(round, value.clone(), a), decided);
    }
}

struct Counterexample {
    seed: u64,
    decided: Vec<String>,
}

fn run_one(seed: u64) -> Result<u64, Counterexample> {
    let mut rng = Rng(seed);

    // 4..=7 validators, equal power 1. Driver is v0; others supply votes. (widened)
    let n = 4 + (rng.below(4) as usize);
    let mut addrs = Vec::with_capacity(n);
    let mut vals = Vec::with_capacity(n);
    for i in 0..n {
        let pk = PrivateKey::from([i as u8 + 1; 32]);
        let addr = Address::from_public_key(&pk.public_key());
        addrs.push(addr);
        vals.push(Validator::new(pk.public_key(), 1));
    }
    let others: Vec<Address> = addrs[1..].to_vec();
    let ctx = TestContext::new();
    let mut driver = Driver::new(ctx, Height::new(H), ValidatorSet::new(vals), addrs[0], Default::default());

    let vals3 = [Value::new(0xAAAA), Value::new(0xBBBB), Value::new(0xCCCC)]; // 3 conflicting values (widened)
    let mut decided: Vec<Value> = Vec::new();

    // Round 0: an honest decision for a random value (keeps the test non-vacuous).
    let first = vals3[rng.below(3) as usize].clone();
    drive_decision(&mut driver, Round::new(0), addrs[1], first, &others, &mut decided);

    // Later rounds: try to force a conflicting decision (Byzantine voters sign a
    // different value in a later round). A correct driver must not decide twice.
    let attempts = 1 + rng.below(5); // up to 5 extra rounds (widened)
    for k in 1..=attempts {
        let value = vals3[rng.below(3) as usize].clone();
        let proposer = addrs[(rng.below(n as u64)) as usize];
        drive_decision(&mut driver, Round::new(k as u32), proposer, value, &others, &mut decided);
    }

    // Agreement: every decided value must be identical.
    let all_same = decided.windows(2).all(|w| w[0] == w[1]);
    if !all_same {
        return Err(Counterexample {
            seed,
            decided: decided.iter().map(|v| format!("{:?}", v.id())).collect(),
        });
    }
    Ok(decided.len() as u64)
}

#[test]
fn shakuni_agreement_no_double_decide() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(20_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xA6411);

    let mut total_decides: u64 = 0;
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        match run_one(seed) {
            Ok(d) => total_decides += d,
            Err(ce) => panic!(
                "AGREEMENT BREAK: driver decided multiple distinct values at one height: {:?}. seed={}",
                ce.decided, ce.seed
            ),
        }
    }

    println!("SHAKUNI_PROPERTY name=agreement_no_double_decide iters={} quorums_verified={} violations=0 result=HELD", iters, total_decides);
    assert!(total_decides > 0, "harness never drove a single decision — property is vacuous");
}
