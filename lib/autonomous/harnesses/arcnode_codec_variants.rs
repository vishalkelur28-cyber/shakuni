// SHAKUNI ADDITION — entire file is new. The original harness
// (arcnode_codec.rs / netcodec_roundtrip_faithful) is unchanged.
//
//! Shakuni autonomous property harness — companion to `arcnode_codec.rs`.
//!
//! Target: circlefin/arc-node, crate arc-consensus-types.
//! Lead: consensus wire-format integrity (same lead as the Vote harness).
//!
//! The original harness only drives `SignedConsensusMsg::Vote` with random
//! fields. This one covers what that leaves out, against the REAL `NetCodec`:
//!   1. `SignedConsensusMsg::Proposal` — incl. `pol_round` (the only Round
//!      field that is legitimately Nil on the wire, encoded as `optional`).
//!   2. Deterministic boundary grid for Vote AND Proposal: height
//!      {1, 2, u32::MAX, u32::MAX+1, u64::MAX-1, u64::MAX}, round
//!      {0, 1, u32::MAX-1, u32::MAX}, value Nil / all-0x00 / all-0xFF,
//!      address all-0x00 / all-0xFF / alternating, signature all-0x00 /
//!      all-0xFF, prevote and precommit.
//!   3. Every `LivenessMsg` variant the Arc codec supports: Vote,
//!      PolkaCertificate, SkipRoundCertificate (both Skip and Precommit
//!      cert types, mixed Nil/Val round signatures).
//!
//! Only protocol-valid messages are built (non-Nil round, height >= 1,
//! pol_round Nil or < round, certificates with >= 1 signature and within
//! Arc's MAX_SIGNATURES_PER_CERTIFICATE). Nothing is corrupted on purpose.
//!
//! Core invariant: decode(encode(m)) == m (full structural equality).
//! HELD = "could not break it"; BROKEN = reproducible seed / case id.

// SHAKUNI ADDITION
use arc_consensus_types::codec::network::NetCodec;
use arc_consensus_types::codec::Codec;
use arc_consensus_types::signing::Signature;
use arc_consensus_types::{Address, ArcContext, BlockHash, Height, Proposal, Round, Value, ValueId, Vote};

use malachitebft_core_consensus::{LivenessMsg, SignedConsensusMsg};
use malachitebft_core_types::{
    NilOrVal, PolkaCertificate, PolkaSignature, RoundCertificate, RoundCertificateType, RoundSignature,
    SignedProposal, SignedVote, VoteType,
};

// SHAKUNI ADDITION — same deterministic SplitMix64 as arcnode_codec.rs.
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
    fn bytes<const N: usize>(&mut self) -> [u8; N] {
        let mut b = [0u8; N];
        for x in b.iter_mut() { *x = (self.next() & 0xff) as u8; }
        b
    }
}

// SHAKUNI ADDITION
type ConsensusMsg = SignedConsensusMsg<ArcContext>;
type Liveness = LivenessMsg<ArcContext>;

// SHAKUNI ADDITION — boundary sets (all protocol-valid values).
const HEIGHTS: [u64; 6] = [1, 2, u32::MAX as u64, u32::MAX as u64 + 1, u64::MAX - 1, u64::MAX];
const ROUNDS: [u32; 4] = [0, 1, u32::MAX - 1, u32::MAX];
const HASHES: [[u8; 32]; 2] = [[0x00; 32], [0xFF; 32]];
const ADDRS: [[u8; 20]; 3] = [[0x00; 20], [0xFF; 20], [0xA5; 20]];
const SIGS: [[u8; 64]; 2] = [[0x00; 64], [0xFF; 64]];

// SHAKUNI ADDITION — round-trip helpers through the real NetCodec.
fn roundtrip_consensus(msg: &ConsensusMsg) -> Result<(), String> {
    let codec = NetCodec;
    let encoded = <NetCodec as Codec<ConsensusMsg>>::encode(&codec, msg).map_err(|e| format!("encode failed: {e:?}"))?;
    let decoded = <NetCodec as Codec<ConsensusMsg>>::decode(&codec, encoded).map_err(|e| format!("decode failed: {e:?}"))?;
    if &decoded != msg {
        return Err(format!("decoded != original\n  original: {msg:?}\n  decoded:  {decoded:?}"));
    }
    Ok(())
}

fn roundtrip_liveness(msg: &Liveness) -> Result<(), String> {
    let codec = NetCodec;
    let encoded = <NetCodec as Codec<Liveness>>::encode(&codec, msg).map_err(|e| format!("encode failed: {e:?}"))?;
    let decoded = <NetCodec as Codec<Liveness>>::decode(&codec, encoded).map_err(|e| format!("decode failed: {e:?}"))?;
    if &decoded != msg {
        return Err(format!("decoded != original\n  original: {msg:?}\n  decoded:  {decoded:?}"));
    }
    Ok(())
}

// SHAKUNI ADDITION — constructors use the real Arc / malachite APIs.
fn vote(typ: VoteType, h: u64, r: u32, value: NilOrVal<ValueId>, addr: [u8; 20]) -> Vote {
    let (h, r, a) = (Height::new(h), Round::new(r), Address::new(addr));
    match typ {
        VoteType::Prevote => Vote::new_prevote(h, r, value, a),
        VoteType::Precommit => Vote::new_precommit(h, r, value, a),
    }
}

fn signed_vote(v: Vote, sig: [u8; 64]) -> SignedVote<ArcContext> {
    SignedVote::new(v, Signature::from_bytes(sig))
}

fn signed_proposal(h: u64, r: u32, hash: [u8; 32], pol: Round, addr: [u8; 20], sig: [u8; 64]) -> SignedProposal<ArcContext> {
    let p = Proposal::new(Height::new(h), Round::new(r), Value::new(BlockHash::from(hash)), pol, Address::new(addr));
    SignedProposal::new(p, Signature::from_bytes(sig))
}

/// Protocol-valid pol_round choices for a given round: Nil, or any round < r.
fn pol_rounds_for(r: u32) -> Vec<Round> {
    let mut v = vec![Round::Nil];
    if r > 0 {
        v.push(Round::new(0));
        v.push(Round::new(r - 1));
    }
    v
}

// SHAKUNI ADDITION — random generators for the seeded sweep.
fn rand_height(rng: &mut Rng) -> u64 {
    match rng.below(4) { 0 => HEIGHTS[rng.below(HEIGHTS.len() as u64) as usize], _ => rng.next().max(1) }
}

fn rand_round(rng: &mut Rng) -> u32 {
    match rng.below(4) { 0 => (rng.next() & 0xffff_ffff) as u32, 1 => ROUNDS[rng.below(ROUNDS.len() as u64) as usize], _ => rng.below(64) as u32 }
}

fn rand_value_id(rng: &mut Rng) -> NilOrVal<ValueId> {
    if rng.below(4) == 0 { NilOrVal::Nil } else { NilOrVal::Val(ValueId::new(BlockHash::from(rng.bytes::<32>()))) }
}

fn rand_vote_type(rng: &mut Rng) -> VoteType {
    if rng.below(2) == 0 { VoteType::Prevote } else { VoteType::Precommit }
}

fn rand_proposal(rng: &mut Rng) -> ConsensusMsg {
    let r = rand_round(rng);
    let pol = if r == 0 || rng.below(3) == 0 { Round::Nil } else { Round::new(rng.below(r as u64) as u32) };
    let sp = signed_proposal(rand_height(rng), r, rng.bytes::<32>(), pol, rng.bytes::<20>(), rng.bytes::<64>());
    SignedConsensusMsg::Proposal(sp)
}

fn rand_liveness(rng: &mut Rng) -> Liveness {
    let (h, r) = (rand_height(rng), rand_round(rng));
    let n = rng.below(32) + 1; // 1..=32 signatures, well under Arc's 1_000 cap
    match rng.below(3) {
        0 => {
            let v = vote(rand_vote_type(rng), h, r, rand_value_id(rng), rng.bytes::<20>());
            LivenessMsg::Vote(signed_vote(v, rng.bytes::<64>()))
        }
        1 => LivenessMsg::PolkaCertificate(PolkaCertificate {
            height: Height::new(h),
            round: Round::new(r),
            value_id: ValueId::new(BlockHash::from(rng.bytes::<32>())),
            polka_signatures: (0..n)
                .map(|_| PolkaSignature::new(Address::new(rng.bytes::<20>()), Signature::from_bytes(rng.bytes::<64>())))
                .collect(),
        }),
        _ => LivenessMsg::SkipRoundCertificate(RoundCertificate {
            height: Height::new(h),
            round: Round::new(r),
            cert_type: if rng.below(2) == 0 { RoundCertificateType::Skip } else { RoundCertificateType::Precommit },
            round_signatures: (0..n)
                .map(|_| {
                    RoundSignature::new(
                        rand_vote_type(rng),
                        rand_value_id(rng),
                        Address::new(rng.bytes::<20>()),
                        Signature::from_bytes(rng.bytes::<64>()),
                    )
                })
                .collect(),
        }),
    }
}

// SHAKUNI ADDITION — the single property test (Shakuni expects exactly 1 passed).
#[test]
fn shakuni_consensus_wire_variants_roundtrip_is_faithful() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(50_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xC0DEC);
    let mut checked: u64 = 0;

    // Phase 1 — deterministic boundary grid (Vote + Proposal, consensus channel;
    // Vote also via the liveness channel, which uses a separate encoder path).
    let mut case: u64 = 0;
    for &h in &HEIGHTS {
        for &r in &ROUNDS {
            for &addr in &ADDRS {
                for &sig in &SIGS {
                    let values = [NilOrVal::Nil, NilOrVal::Val(ValueId::new(BlockHash::from(HASHES[0]))), NilOrVal::Val(ValueId::new(BlockHash::from(HASHES[1])))];
                    for value in values {
                        for typ in [VoteType::Prevote, VoteType::Precommit] {
                            case += 1;
                            let sv = signed_vote(vote(typ, h, r, value, addr), sig);
                            if let Err(d) = roundtrip_consensus(&SignedConsensusMsg::Vote(sv.clone())) {
                                panic!("CODEC ASYMMETRY: boundary Vote case={case} h={h} r={r}: {d}");
                            }
                            if let Err(d) = roundtrip_liveness(&LivenessMsg::Vote(sv)) {
                                panic!("CODEC ASYMMETRY: boundary LivenessMsg::Vote case={case} h={h} r={r}: {d}");
                            }
                            checked += 2;
                        }
                    }
                    for hash in HASHES {
                        for pol in pol_rounds_for(r) {
                            case += 1;
                            let msg = SignedConsensusMsg::Proposal(signed_proposal(h, r, hash, pol, addr, sig));
                            if let Err(d) = roundtrip_consensus(&msg) {
                                panic!("CODEC ASYMMETRY: boundary Proposal case={case} h={h} r={r} pol={pol:?}: {d}");
                            }
                            checked += 1;
                        }
                    }
                }
            }
        }
    }

    // Phase 2 — seeded random sweep: Proposal + every LivenessMsg variant.
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        let mut rng = Rng(seed);
        let p = rand_proposal(&mut rng);
        if let Err(d) = roundtrip_consensus(&p) {
            panic!("CODEC ASYMMETRY: Proposal {d} seed={seed}");
        }
        let l = rand_liveness(&mut rng);
        if let Err(d) = roundtrip_liveness(&l) {
            panic!("CODEC ASYMMETRY: LivenessMsg {d} seed={seed}");
        }
        checked += 2;
    }

    println!("SHAKUNI_PROPERTY name=consensus_wire_variants_roundtrip_faithful iters={} quorums_verified={} violations=0 result=HELD", iters, checked);
    assert!(checked > 0, "harness never round-tripped a message — property is vacuous");
}
