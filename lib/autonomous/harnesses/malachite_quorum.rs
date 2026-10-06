//! Shakuni autonomous property harness — runs against the REAL VoteKeeper.
//!
//! Lead (malachite): "Commit accepted without a genuine +2/3 precommit set"
//! (quorum integrity) and "Equivocation not rejected / double-counted".
//!
//! Method: drive the real `VoteKeeper` with many randomized precommit
//! sequences over a validator set with random voting power, including
//! deliberate equivocation (a validator voting for two different values).
//! Independently recompute, outside the keeper, the distinct voting power that
//! precommitted each value (first precommit per validator wins — equivocating
//! duplicates must not count). Whenever the keeper announces
//! `Output::PrecommitValue(v)`, assert that our independent recount actually
//! meets the 2/3 quorum (`power*3 > total*2`, from ThresholdParam::TWO_F_PLUS_ONE).
//!
//! A single sequence where the keeper announces a quorum our recount does not
//! support would be a real quorum-forgery / double-count bug. The harness is a
//! searcher: it reports the first counterexample (seed + sequence) or, finding
//! none, reports the invariant held across N iterations.
//!
//! This is real execution of in-scope code, not a model. It is a soundness
//! check; a pass means "could not break it", which is the honest outcome.

use std::collections::BTreeMap;

use malachitebft_core_types::{NilOrVal, Round, VotingPower};
use arc_malachitebft_core_votekeeper::keeper::{Output, VoteKeeper};
use malachitebft_test::{
    Address, Height, PrivateKey, Signature, TestContext, Validator, ValidatorSet, ValueId, Vote,
};

/// Deterministic PRNG (splitmix64) so every run and any counterexample is reproducible.
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

fn signed_precommit(
    height: Height,
    round: Round,
    value: NilOrVal<ValueId>,
    addr: Address,
) -> malachitebft_core_types::SignedVote<TestContext> {
    malachitebft_core_types::SignedVote::new(
        Vote::new_precommit(height, round, value, addr),
        Signature::test(),
    )
}

/// 2/3 quorum met, exactly as ThresholdParam::TWO_F_PLUS_ONE::is_met(power, total).
fn meets_quorum(power: VotingPower, total: VotingPower) -> bool {
    power.saturating_mul(3) > total.saturating_mul(2)
}

struct Counterexample {
    seed: u64,
    n: usize,
    powers: Vec<VotingPower>,
    seq: Vec<(usize, NilOrVal<ValueId>)>,
    announced: ValueId,
    recount_power: VotingPower,
    total: VotingPower,
}

fn run_one(seed: u64) -> Result<u64, Counterexample> {
    let mut verified: u64 = 0;
    let mut rng = Rng(seed);
    let n = 3 + (rng.below(10) as usize); // 3..=12 validators (widened)
    let powers: Vec<VotingPower> = (0..n).map(|_| 1 + rng.below(8)).collect(); // 1..=8 each (widened)
    let total: VotingPower = powers.iter().sum();

    // Build the real validator set.
    let mut addrs = Vec::with_capacity(n);
    let mut vals = Vec::with_capacity(n);
    for i in 0..n {
        let pk = PrivateKey::from([i as u8 + 1; 32]);
        let addr = Address::from_public_key(&pk.public_key());
        addrs.push(addr);
        vals.push(Validator::new(pk.public_key(), powers[i]));
    }
    let mut keeper: VoteKeeper<TestContext> = VoteKeeper::new(ValidatorSet::new(vals), Default::default());

    let height = Height::new(1);
    let round = Round::new(0);
    let values = [NilOrVal::Nil, NilOrVal::Val(ValueId::new(1)), NilOrVal::Val(ValueId::new(2)), NilOrVal::Val(ValueId::new(3)), NilOrVal::Val(ValueId::new(4))];

    // Our independent ground truth: first precommit per validator wins.
    let mut first_vote: BTreeMap<usize, NilOrVal<ValueId>> = BTreeMap::new();
    let mut seq: Vec<(usize, NilOrVal<ValueId>)> = Vec::new();

    let events = 1 + (rng.below((6 * n) as u64) as usize); // deeper sequences (widened)
    for _ in 0..events {
        let v = rng.below(n as usize as u64) as usize;
        let val = values[rng.below(values.len() as u64) as usize];
        seq.push((v, val));
        first_vote.entry(v).or_insert(val); // equivocating later votes don't change ground truth

        let out = keeper.apply_vote(signed_precommit(height, round, val, addrs[v]), round);

        if let Some(Output::PrecommitValue(announced)) = out {
            // Recompute the distinct power that (first-)precommitted the announced value.
            let target = NilOrVal::Val(announced);
            let recount: VotingPower = first_vote
                .iter()
                .filter(|(_, &fv)| fv == target)
                .map(|(&idx, _)| powers[idx])
                .sum();
            if !meets_quorum(recount, total) {
                return Err(Counterexample { seed, n, powers, seq, announced, recount_power: recount, total });
            }
            verified += 1;
        }
    }
    Ok(verified)
}

#[test]
fn shakuni_precommit_quorum_is_sound() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(100_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xC0FFEE);

    let mut verified_quorums: u64 = 0;
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        match run_one(seed) {
            Ok(v) => verified_quorums += v,
            Err(ce) => {
                let seqstr: Vec<String> = ce.seq.iter().map(|(v, val)| format!("v{}->{}", v, match val { NilOrVal::Nil => "nil".to_string(), NilOrVal::Val(id) => format!("{:?}", id) })).collect();
                panic!(
                    "QUORUM FORGERY: keeper announced PrecommitValue({:?}) but independent recount power={} does not meet 2/3 of total={} (n={}, powers={:?}). seed={} seq=[{}]",
                    ce.announced, ce.recount_power, ce.total, ce.n, ce.powers, ce.seed, seqstr.join(", ")
                );
            }
        }
    }

    println!("SHAKUNI_PROPERTY name=precommit_quorum_soundness iters={} quorums_verified={} violations=0 result=HELD", iters, verified_quorums);
    assert!(verified_quorums > 0, "harness never exercised a real quorum announcement — property is vacuous");
}
