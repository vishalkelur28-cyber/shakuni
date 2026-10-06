//! Shakuni autonomous property harness — runs against arc-node's REAL network codec.
//!
//! Target: circlefin/arc-node, crate arc-consensus-types.
//! Lead: consensus wire-format integrity. A codec that is not a faithful
//! round-trip (encode then decode changes the message) can make honest nodes
//! disagree on what was sent — a consensus-safety/liveness break.
//!
//! Core invariant: for every consensus message, decode(encode(m)) == m.
//! Method: build randomized signed consensus votes (random height, round,
//! value incl. nil, address, signature, prevote/precommit), run them through
//! the real `NetCodec`, and assert every field survives the round trip.
//!
//! HELD = "could not break it"; BROKEN = reproducible seed.

use arc_consensus_types::codec::network::NetCodec;
use arc_consensus_types::codec::Codec;
use arc_consensus_types::signing::Signature;
use arc_consensus_types::{Address, BlockHash, Height, Round, ValueId, Vote};

use alloy_primitives::Address as AlloyAddress;
use malachitebft_core_consensus::SignedConsensusMsg;
use malachitebft_core_types::{NilOrVal, SignedVote, Vote as _};

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

type Msg = SignedConsensusMsg<arc_consensus_types::ArcContext>;

fn make_msg(rng: &mut Rng) -> Msg {
    let height = Height::new(rng.below(1_000_000) + 1);
    let round = Round::new(rng.below(64) as u32);
    let value = if rng.below(4) == 0 {
        NilOrVal::Nil
    } else {
        NilOrVal::Val(ValueId::new(BlockHash::from(rng.bytes::<32>())))
    };
    let addr = Address::from(AlloyAddress::from(rng.bytes::<20>()));
    let sig = Signature::from_bytes(rng.bytes::<64>());
    let vote = if rng.below(2) == 0 {
        Vote::new_prevote(height, round, value, addr)
    } else {
        Vote::new_precommit(height, round, value, addr)
    };
    SignedConsensusMsg::Vote(SignedVote::new(vote, sig))
}

fn roundtrips(msg: &Msg) -> Result<(), String> {
    let codec = NetCodec;
    let encoded = codec.encode(msg).map_err(|e| format!("encode failed: {e:?}"))?;
    let decoded: Msg = codec.decode(encoded).map_err(|e| format!("decode failed: {e:?}"))?;
    match (msg, &decoded) {
        (SignedConsensusMsg::Vote(a), SignedConsensusMsg::Vote(b)) => {
            if a.message.height() != b.message.height() { return Err("height changed".into()); }
            if a.message.round() != b.message.round() { return Err("round changed".into()); }
            if a.message.value() != b.message.value() { return Err("value changed".into()); }
            if a.message.validator_address() != b.message.validator_address() { return Err("address changed".into()); }
            if a.message.vote_type() != b.message.vote_type() { return Err("vote type changed".into()); }
            if a.signature != b.signature { return Err("signature changed".into()); }
            Ok(())
        }
        _ => Err("message variant changed (Vote → non-Vote)".into()),
    }
}

#[test]
fn shakuni_netcodec_roundtrip_is_faithful() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(50_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xC0DEC);

    let mut checked: u64 = 0;
    for i in 0..iters {
        let mut rng = Rng(base ^ i.wrapping_mul(0x100000001B3));
        let msg = make_msg(&mut rng);
        if let Err(detail) = roundtrips(&msg) {
            panic!("CODEC ASYMMETRY: {} seed={}", detail, base ^ i.wrapping_mul(0x100000001B3));
        }
        checked += 1;
    }

    println!("SHAKUNI_PROPERTY name=netcodec_roundtrip_faithful iters={} quorums_verified={} violations=0 result=HELD", iters, checked);
    assert!(checked > 0, "harness never round-tripped a message — property is vacuous");
}
