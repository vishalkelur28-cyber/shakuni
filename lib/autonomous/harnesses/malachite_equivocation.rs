//! Shakuni autonomous property harness — runs against the REAL VoteKeeper.
//!
//! Lead (malachite): "Equivocation (double-sign) not rejected / double-counted".
//!
//! Method: drive the real `VoteKeeper` with randomized precommit sequences in
//! which some validators deliberately equivocate (two different values for the
//! same height/round/type). Independently track which validators equivocated,
//! then assert the keeper's `evidence()` map is BOTH:
//!   - complete  — every validator that equivocated is recorded, and
//!   - sound     — no validator that did NOT equivocate is recorded.
//!
//! A run where evidence is incomplete (a double-signer goes unrecorded) or
//! unsound (an honest validator is falsely accused) is a real evidence-handling
//! bug. HELD = "could not break it" (honest outcome); BROKEN = reproducible seed.

use std::collections::{BTreeMap, BTreeSet};

use malachitebft_core_types::{NilOrVal, Round, SignedVote};
use arc_malachitebft_core_votekeeper::keeper::VoteKeeper;
use malachitebft_test::{
    Address, Height, PrivateKey, Signature, TestContext, Validator, ValidatorSet, ValueId, Vote,
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

fn signed_precommit(round: Round, value: NilOrVal<ValueId>, addr: Address) -> SignedVote<TestContext> {
    SignedVote::new(Vote::new_precommit(Height::new(1), round, value, addr), Signature::test())
}

struct Counterexample {
    seed: u64,
    missing: Vec<String>, // equivocators the keeper failed to record (completeness)
    extra: Vec<String>,   // validators falsely recorded (soundness)
}

fn run_one(seed: u64) -> Result<u64, Counterexample> {
    let mut rng = Rng(seed);
    let n = 3 + (rng.below(10) as usize); // 3..=12 validators (widened)

    let mut addrs = Vec::with_capacity(n);
    let mut vals = Vec::with_capacity(n);
    for i in 0..n {
        let pk = PrivateKey::from([i as u8 + 1; 32]);
        let addr = Address::from_public_key(&pk.public_key());
        addrs.push(addr);
        vals.push(Validator::new(pk.public_key(), 1 + rng.below(4)));
    }
    let mut keeper: VoteKeeper<TestContext> = VoteKeeper::new(ValidatorSet::new(vals), Default::default());

    // Values include Nil so a Nil-then-Val switch also counts as a conflict.
    let values = [NilOrVal::Nil, NilOrVal::Val(ValueId::new(1)), NilOrVal::Val(ValueId::new(2)), NilOrVal::Val(ValueId::new(3)), NilOrVal::Val(ValueId::new(4))];

    // Ground truth: first value per (validator, round); a later different value = equivocation.
    let mut first: BTreeMap<(usize, u32), NilOrVal<ValueId>> = BTreeMap::new();
    let mut equivocators: BTreeSet<usize> = BTreeSet::new();

    let events = 2 + (rng.below((6 * n) as u64) as usize); // deeper sequences (widened)
    for _ in 0..events {
        let v = rng.below(n as u64) as usize;
        let round = rng.below(5) as u32; // rounds 0..=4 (widened)
        let val = values[rng.below(values.len() as u64) as usize];
        if let Some(&prev) = first.get(&(v, round)) {
            if prev != val {
                equivocators.insert(v);
            }
        } else {
            first.insert((v, round), val);
        }
        keeper.apply_vote(signed_precommit(Round::new(round), val, addrs[v]), Round::new(round));
    }

    // What the real keeper recorded.
    let recorded: BTreeSet<usize> = keeper
        .evidence()
        .iter()
        .filter_map(|(addr, _)| addrs.iter().position(|a| a == addr))
        .collect();

    let missing: Vec<usize> = equivocators.difference(&recorded).copied().collect();
    let extra: Vec<usize> = recorded.difference(&equivocators).copied().collect();

    if !missing.is_empty() || !extra.is_empty() {
        return Err(Counterexample {
            seed,
            missing: missing.iter().map(|i| format!("v{}", i)).collect(),
            extra: extra.iter().map(|i| format!("v{}", i)).collect(),
        });
    }
    Ok(equivocators.len() as u64)
}

#[test]
fn shakuni_equivocation_evidence_is_complete_and_sound() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(100_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xE0417);

    let mut total_equivocators: u64 = 0;
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        match run_one(seed) {
            Ok(e) => total_equivocators += e,
            Err(ce) => panic!(
                "EVIDENCE MISMATCH: equivocators not recorded (incomplete)={:?}; honest validators falsely recorded (unsound)={:?}. seed={}",
                ce.missing, ce.extra, ce.seed
            ),
        }
    }

    println!("SHAKUNI_PROPERTY name=equivocation_evidence_complete iters={} quorums_verified={} violations=0 result=HELD", iters, total_equivocators);
    assert!(total_equivocators > 0, "harness never produced an equivocation — property is vacuous");
}
