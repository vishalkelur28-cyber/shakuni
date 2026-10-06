// SHAKUNI ADDITION — entire file is new. Existing harnesses are unchanged.
//
//! Shakuni autonomous property harness — arc-node proposal streaming codec.
//!
//! Target: circlefin/arc-node, crate arc-consensus-types.
//! Lead: consensus wire-format integrity for block proposals. Proposals are
//! gossiped as a stream of `ProposalPart`s (Init → Data… → Fin) wrapped in
//! `StreamMessage`s. If that codec is not faithful, honest nodes can rebuild
//! a different block than the proposer sent, or reject a valid proposal.
//! Because `ProposalPart::to_sign_bytes` IS the protobuf encoding, the
//! encoding must also be byte-stable: re-encoding a decoded part must give
//! the exact same bytes, or signatures computed on either side diverge.
//!
//! Paths exercised (all real Arc code, pinned commit):
//!   - NetCodec  : ProposalPart                (Init / Data / Fin)
//!   - NetCodec  : StreamMessage<ProposalPart> (Data(part) / Fin, nested encoding)
//!   - ProtobufCodec : ProposalParts           (full assembled proposal)
//!
//! Invariants per message m:
//!   1. decode(encode(m)) == m                      (faithful round trip)
//!   2. encode(decode(encode(m))) == encode(m)      (byte-stable / canonical)
//!   3. ProposalPart only: to_sign_bytes() is unchanged across the round trip
//!
//! Only protocol-valid messages are built: height >= 1, defined round,
//! pol_round Nil or < round, 16-byte stream ids, streams shaped
//! Init(seq 0) → Data… → Fin part → stream Fin. Nothing is corrupted.
//! HELD = "could not break it"; BROKEN = reproducible seed / case id.

// SHAKUNI ADDITION
use arc_consensus_types::codec::network::NetCodec;
use arc_consensus_types::codec::proto::ProtobufCodec;
use arc_consensus_types::codec::Codec;
use arc_consensus_types::signing::Signature;
use arc_consensus_types::{
    Address, Height, ProposalData, ProposalFin, ProposalInit, ProposalPart, ProposalParts, Round,
};
use bytes::Bytes;
use malachitebft_app::engine::util::streaming::{StreamContent, StreamId, StreamMessage};

// SHAKUNI ADDITION — same deterministic SplitMix64 as the other arc-node harnesses.
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
    fn vec(&mut self, len: usize) -> Vec<u8> {
        (0..len).map(|_| (self.next() & 0xff) as u8).collect()
    }
}

// SHAKUNI ADDITION
type Stream = StreamMessage<ProposalPart>;

// SHAKUNI ADDITION — boundary sets (all protocol-valid values).
const HEIGHTS: [u64; 4] = [1, u32::MAX as u64 + 1, u64::MAX - 1, u64::MAX];
const ROUNDS: [u32; 3] = [0, 1, u32::MAX];
const ADDRS: [[u8; 20]; 2] = [[0x00; 20], [0xFF; 20]];
const SIGS: [[u8; 64]; 2] = [[0x00; 64], [0xFF; 64]];
const SEQS: [u64; 4] = [0, 1, u32::MAX as u64 + 1, u64::MAX];
/// Data-chunk sizes: empty, 1 byte, varint length boundaries (127/128, 16383/16384), 64 KiB.
const DATA_LENS: [usize; 7] = [0, 1, 127, 128, 16_383, 16_384, 65_536];

// SHAKUNI ADDITION — generic checker: faithful + byte-stable round trip.
fn check<C, T>(codec: &C, msg: &T) -> Result<(), String>
where
    C: Codec<T>,
    C::Error: std::fmt::Debug,
    T: PartialEq + std::fmt::Debug,
{
    let enc1 = codec.encode(msg).map_err(|e| format!("encode failed: {e:?}"))?;
    let decoded = codec.decode(enc1.clone()).map_err(|e| format!("decode failed: {e:?}"))?;
    if &decoded != msg {
        return Err(format!("decoded != original\n  original: {msg:?}\n  decoded:  {decoded:?}"));
    }
    let enc2 = codec.encode(&decoded).map_err(|e| format!("re-encode failed: {e:?}"))?;
    if enc1 != enc2 {
        return Err(format!("non-canonical encoding: {} bytes vs {} bytes after re-encode", enc1.len(), enc2.len()));
    }
    Ok(())
}

fn check_part(part: &ProposalPart) -> Result<(), String> {
    check(&NetCodec, part)?;
    // Signing preimage must survive the wire unchanged.
    let enc = <NetCodec as Codec<ProposalPart>>::encode(&NetCodec, part).map_err(|e| format!("{e:?}"))?;
    let dec = <NetCodec as Codec<ProposalPart>>::decode(&NetCodec, enc).map_err(|e| format!("{e:?}"))?;
    if part.to_sign_bytes() != dec.to_sign_bytes() {
        return Err("to_sign_bytes changed across round trip".into());
    }
    Ok(())
}

fn check_stream(msg: &Stream) -> Result<(), String> { check(&NetCodec, msg) }

fn check_parts(parts: &ProposalParts) -> Result<(), String> { check(&ProtobufCodec, parts) }

// SHAKUNI ADDITION — constructors use the real Arc / malachite APIs.
fn init(h: u64, r: u32, pol: Round, addr: [u8; 20]) -> ProposalPart {
    ProposalPart::Init(ProposalInit::new(Height::new(h), Round::new(r), pol, Address::new(addr)))
}
fn data(bytes: Vec<u8>) -> ProposalPart { ProposalPart::Data(ProposalData::new(Bytes::from(bytes))) }
fn fin(sig: [u8; 64]) -> ProposalPart { ProposalPart::Fin(ProposalFin::new(Signature::from_bytes(sig))) }

fn stream_msg(id: [u8; 16], seq: u64, content: StreamContent<ProposalPart>) -> Stream {
    StreamMessage::new(StreamId::new(Bytes::copy_from_slice(&id)), seq, content)
}

/// Protocol-valid pol_round choices: Nil, or any round < r.
fn pol_rounds_for(r: u32) -> Vec<Round> {
    let mut v = vec![Round::Nil];
    if r > 0 { v.push(Round::new(0)); v.push(Round::new(r - 1)); }
    v
}

// SHAKUNI ADDITION — random generators for the seeded sweep.
fn rand_height(rng: &mut Rng) -> u64 {
    if rng.below(4) == 0 { HEIGHTS[rng.below(HEIGHTS.len() as u64) as usize] } else { rng.next().max(1) }
}
fn rand_round(rng: &mut Rng) -> u32 {
    match rng.below(4) { 0 => (rng.next() & 0xffff_ffff) as u32, 1 => ROUNDS[rng.below(ROUNDS.len() as u64) as usize], _ => rng.below(64) as u32 }
}
fn rand_pol(rng: &mut Rng, r: u32) -> Round {
    if r == 0 || rng.below(3) == 0 { Round::Nil } else { Round::new(rng.below(r as u64) as u32) }
}
fn rand_data_len(rng: &mut Rng) -> usize {
    if rng.below(5) == 0 { DATA_LENS[rng.below(DATA_LENS.len() as u64) as usize] } else { rng.below(2048) as usize }
}

/// A full, well-formed proposal stream: Init(seq 0), 0..8 Data, Fin part, stream Fin.
fn rand_stream(rng: &mut Rng) -> (Vec<ProposalPart>, Vec<Stream>) {
    let id = rng.bytes::<16>();
    let r = rand_round(rng);
    let pol = rand_pol(rng, r);
    let mut parts = vec![init(rand_height(rng), r, pol, rng.bytes::<20>())];
    for _ in 0..rng.below(9) {
        let len = rand_data_len(rng);
        parts.push(data(rng.vec(len)));
    }
    parts.push(fin(rng.bytes::<64>()));

    let mut msgs: Vec<Stream> = parts.iter().enumerate()
        .map(|(i, p)| stream_msg(id, i as u64, StreamContent::Data(p.clone())))
        .collect();
    msgs.push(stream_msg(id, parts.len() as u64, StreamContent::Fin));
    (parts, msgs)
}

// SHAKUNI ADDITION — the single property test (Shakuni expects exactly 1 passed).
#[test]
fn shakuni_proposal_stream_roundtrip_is_faithful() {
    let iters: u64 = std::env::var("SHAKUNI_ITERS").ok().and_then(|s| s.parse().ok()).unwrap_or(50_000);
    let base: u64 = std::env::var("SHAKUNI_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(0xC0DEC);
    let mut checked: u64 = 0;
    let mut case: u64 = 0;

    // Phase 1 — deterministic boundary grid.
    // 1a. Init parts: height × round × pol_round × proposer.
    for &h in &HEIGHTS {
        for &r in &ROUNDS {
            for pol in pol_rounds_for(r) {
                for &a in &ADDRS {
                    case += 1;
                    if let Err(d) = check_part(&init(h, r, pol, a)) {
                        panic!("CODEC ASYMMETRY: boundary ProposalPart::Init case={case} h={h} r={r} pol={pol:?}: {d}");
                    }
                    checked += 1;
                }
            }
        }
    }
    // 1b. Data parts: size boundaries × fill pattern (0x00 / 0xFF).
    for &len in &DATA_LENS {
        for fill in [0x00u8, 0xFF] {
            case += 1;
            if let Err(d) = check_part(&data(vec![fill; len])) {
                panic!("CODEC ASYMMETRY: boundary ProposalPart::Data case={case} len={len} fill={fill:#x}: {d}");
            }
            checked += 1;
        }
    }
    // 1c. Fin parts: signature boundaries.
    for &s in &SIGS {
        case += 1;
        if let Err(d) = check_part(&fin(s)) {
            panic!("CODEC ASYMMETRY: boundary ProposalPart::Fin case={case}: {d}");
        }
        checked += 1;
    }
    // 1d. StreamMessage wrapper: sequence boundaries × stream id × every content kind.
    let sample_parts = [init(1, 0, Round::Nil, [0xAB; 20]), data(vec![0xCD; 300]), data(Vec::new()), fin([0xEF; 64])];
    for &seq in &SEQS {
        for id in [[0x00u8; 16], [0xFFu8; 16]] {
            for p in &sample_parts {
                case += 1;
                if let Err(d) = check_stream(&stream_msg(id, seq, StreamContent::Data(p.clone()))) {
                    panic!("CODEC ASYMMETRY: boundary StreamMessage::Data case={case} seq={seq}: {d}");
                }
                checked += 1;
            }
            case += 1;
            if let Err(d) = check_stream(&stream_msg(id, seq, StreamContent::Fin)) {
                panic!("CODEC ASYMMETRY: boundary StreamMessage::Fin case={case} seq={seq}: {d}");
            }
            checked += 1;
        }
    }

    // Phase 2 — seeded random sweep: whole proposal streams, every message,
    // plus the assembled ProposalParts through the store/sync codec.
    for i in 0..iters {
        let seed = base ^ i.wrapping_mul(0x100000001B3);
        let mut rng = Rng(seed);
        let (parts, msgs) = rand_stream(&mut rng);
        for p in &parts {
            if let Err(d) = check_part(p) {
                panic!("CODEC ASYMMETRY: ProposalPart::{} {d} seed={seed}", p.get_type());
            }
            checked += 1;
        }
        for (k, m) in msgs.iter().enumerate() {
            if let Err(d) = check_stream(m) {
                panic!("CODEC ASYMMETRY: StreamMessage #{k} {d} seed={seed}");
            }
            checked += 1;
        }
        let assembled = ProposalParts::new(parts).expect("stream always has exactly one Init and one Fin");
        if let Err(d) = check_parts(&assembled) {
            panic!("CODEC ASYMMETRY: ProposalParts {d} seed={seed}");
        }
        checked += 1;
    }

    println!("SHAKUNI_PROPERTY name=proposal_stream_roundtrip_faithful iters={} quorums_verified={} violations=0 result=HELD", iters, checked);
    assert!(checked > 0, "harness never round-tripped a message — property is vacuous");
}
