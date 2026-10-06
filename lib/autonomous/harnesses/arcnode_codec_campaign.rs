// SHAKUNI ADDITION
//! Shakuni real-codec campaign harness.
//!
//! This harness runs against the REAL arc-consensus-types implementation.
//!
//! It expands the existing codec coverage with SignedConsensusMsg::Proposal.
//!
//! IMPORTANT:
//! - This does not modify Arc production code.
//! - This does not manufacture a BROKEN result.
//! - BROKEN can occur only when the real NetCodec produces a genuine
//!   semantic mismatch.
//! - A successful campaign remains HELD.

use arc_consensus_types::codec::network::NetCodec;
use arc_consensus_types::codec::Codec;
use arc_consensus_types::signing::Signature;
use arc_consensus_types::{
    Address,
    BlockHash,
    Height,
    Proposal,
    Round,
    Value,
};

use alloy_primitives::Address as AlloyAddress;
use malachitebft_core_consensus::SignedConsensusMsg;
use malachitebft_core_types::SignedProposal;

// SHAKUNI ADDITION
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_add(0x9E3779B97F4A7C15);

        let mut z = self.0;

        z = (z ^ (z >> 30))
            .wrapping_mul(0xBF58476D1CE4E5B9);

        z = (z ^ (z >> 27))
            .wrapping_mul(0x94D049BB133111EB);

        z ^ (z >> 31)
    }

    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }

    fn bytes<const N: usize>(&mut self) -> [u8; N] {
        let mut bytes = [0u8; N];

        for byte in bytes.iter_mut() {
            *byte = (self.next() & 0xff) as u8;
        }

        bytes
    }
}

// SHAKUNI ADDITION
type Msg =
    SignedConsensusMsg<arc_consensus_types::ArcContext>;

// SHAKUNI ADDITION
fn make_proposal(
    rng: &mut Rng,
) -> Msg {
    let height =
        Height::new(rng.below(1_000_000) + 1);

    let round =
        Round::new(rng.below(128) as u32);

    let pol_round = if rng.below(4) == 0 {
        Round::Nil
    } else {
        Round::new(rng.below(128) as u32)
    };

    let value =
        Value::new(BlockHash::from(
            rng.bytes::<32>(),
        ));

    let validator_address =
        Address::from(
            AlloyAddress::from(
                rng.bytes::<20>(),
            ),
        );

    let proposal = Proposal::new(
        height,
        round,
        value,
        pol_round,
        validator_address,
    );

    let signature =
        Signature::from_bytes(
            rng.bytes::<64>(),
        );

    SignedConsensusMsg::Proposal(
        SignedProposal::new(
            proposal,
            signature,
        ),
    )
}

// SHAKUNI ADDITION
fn roundtrip(
    message: &Msg,
) -> Result<(), String> {
    let codec = NetCodec;

    let encoded = codec
        .encode(message)
        .map_err(|error| {
            format!(
                "encode failed: {error:?}"
            )
        })?;

    let decoded: Msg = codec
        .decode(encoded)
        .map_err(|error| {
            format!(
                "decode failed: {error:?}"
            )
        })?;

    match (message, &decoded) {
        (
            SignedConsensusMsg::Proposal(original),
            SignedConsensusMsg::Proposal(decoded),
        ) => {
            if original.message.height
                != decoded.message.height
            {
                return Err(
                    "proposal height changed"
                        .into(),
                );
            }

            if original.message.round
                != decoded.message.round
            {
                return Err(
                    "proposal round changed"
                        .into(),
                );
            }

            if original.message.value
                != decoded.message.value
            {
                return Err(
                    "proposal value changed"
                        .into(),
                );
            }

            if original.message.pol_round
                != decoded.message.pol_round
            {
                return Err(
                    "proposal pol_round changed"
                        .into(),
                );
            }

            if original
                .message
                .validator_address
                != decoded
                    .message
                    .validator_address
            {
                return Err(
                    "proposal validator address changed"
                        .into(),
                );
            }

            if original.signature
                != decoded.signature
            {
                return Err(
                    "proposal signature changed"
                        .into(),
                );
            }

            Ok(())
        }

        (
            SignedConsensusMsg::Proposal(_),
            SignedConsensusMsg::Vote(_),
        ) => Err(
            "message variant changed: Proposal -> Vote"
                .into(),
        ),

        (
            SignedConsensusMsg::Proposal(_),
            _,
        ) => Err(
            "message variant changed"
                .into(),
        ),

        _ => Err(
            "unexpected message variant"
                .into(),
        ),
    }
}

// SHAKUNI ADDITION
#[test]
fn shakuni_netcodec_proposal_campaign() {
    let iterations: u64 =
        std::env::var("SHAKUNI_ITERS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(5_000);

    let base_seed: u64 =
        std::env::var("SHAKUNI_SEED")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0xC0DEC);

    let mut checked = 0u64;

    for index in 0..iterations {
        let seed =
            base_seed ^ index
                .wrapping_mul(
                    0x100000001B3,
                );

        let mut rng = Rng(seed);

        let message =
            make_proposal(&mut rng);

        if let Err(detail) =
            roundtrip(&message)
        {
            panic!(
                "CODEC ASYMMETRY: {} seed={} case=proposal",
                detail,
                seed
            );
        }

        checked += 1;
    }

    println!(
        "SHAKUNI_PROPERTY name=netcodec_proposal_campaign iters={} quorums_verified={} violations=0 result=HELD",
        iterations,
        checked
    );

    assert!(
        checked > 0,
        "harness never tested a proposal"
    );
}