/**
 * Harness registry, pure data, client-safe (no node imports).
 *
 * Each entry ties a lead (hypotheses.ts id) to a Rust property harness Shakuni
 * ships, for a specific in-scope repo. The autonomous flow reads this to decide
 * which harnesses to generate and run for the selected target.
 */
export interface HarnessDef {
  repo: string;      // which in-scope repo this harness targets
  leadId: string;    // hypotheses.ts lead id (unique across repos)
  property: string;
  crate: string;
  testName: string;
  srcFile: string;   // canonical source in lib/autonomous/harnesses/
  destRel: string;   // path inside the cloned repo's cargo workspace
  /** Cap iterations for this harness (I/O-bound ones run fewer so the flow stays fast). */
  capIters?: number;
}

export const HARNESSES: HarnessDef[] = [
  // circlefin/malachite, consensus core (5 safety properties)
  { repo: "circlefin/malachite", leadId: "mal-quorum", property: "precommit_quorum_soundness", crate: "arc-malachitebft-core-votekeeper", testName: "shakuni_quorum_property", srcFile: "malachite_quorum.rs", destRel: "crates/core-votekeeper/tests/shakuni_quorum_property.rs" },
  { repo: "circlefin/malachite", leadId: "mal-agreement", property: "agreement_no_double_decide", crate: "arc-malachitebft-core-driver", testName: "shakuni_agreement", srcFile: "malachite_agreement.rs", destRel: "crates/core-driver/tests/shakuni_agreement.rs" },
  { repo: "circlefin/malachite", leadId: "mal-equiv", property: "equivocation_evidence_complete", crate: "arc-malachitebft-core-votekeeper", testName: "shakuni_equivocation", srcFile: "malachite_equivocation.rs", destRel: "crates/core-votekeeper/tests/shakuni_equivocation.rs" },
  { repo: "circlefin/malachite", leadId: "mal-lock", property: "precommit_requires_polka", crate: "arc-malachitebft-core-driver", testName: "shakuni_locking", srcFile: "malachite_locking.rs", destRel: "crates/core-driver/tests/shakuni_locking.rs" },
  { repo: "circlefin/malachite", leadId: "mal-wal", property: "wal_roundtrip_exact", crate: "arc-malachitebft-wal", testName: "shakuni_wal", srcFile: "malachite_wal.rs", destRel: "crates/wal/tests/shakuni_wal.rs", capIters: 1500 },

  // circlefin/arc-node, Arc L1 node (Rust)
  { repo: "circlefin/arc-node", leadId: "node-codec", property: "netcodec_roundtrip_faithful", crate: "arc-consensus-types", testName: "shakuni_codec", srcFile: "arcnode_codec.rs", destRel: "crates/types/tests/shakuni_codec.rs" },

  // SHAKUNI ADDITION, real Arc proposal codec campaign.
  // Runs the new Proposal-focused campaign harness against the pinned Arc code.
  {
    repo: "circlefin/arc-node",
    leadId: "node-codec-campaign",
    property: "netcodec_proposal_campaign",
    crate: "arc-consensus-types",
    testName: "shakuni_codec_campaign",
    srcFile: "arcnode_codec_campaign.rs",
    destRel: "crates/types/tests/shakuni_codec_campaign.rs",
  },

  // SHAKUNI ADDITION, companion codec harness: SignedConsensusMsg::Proposal (incl. Nil/defined pol_round),
  // height/round/value/address/signature boundary grid, and every LivenessMsg variant (Vote, PolkaCertificate,
  // SkipRoundCertificate) through the real NetCodec. Separate leadId so the original node-codec mapping is untouched.
  { repo: "circlefin/arc-node", leadId: "node-codec-variants", property: "consensus_wire_variants_roundtrip_faithful", crate: "arc-consensus-types", testName: "shakuni_codec_variants", srcFile: "arcnode_codec_variants.rs", destRel: "crates/types/tests/shakuni_codec_variants.rs" }, // SHAKUNI ADDITION

  // SHAKUNI ADDITION, proposal streaming codec: ProposalPart (Init/Data/Fin) and StreamMessage<ProposalPart> via the
  // real NetCodec, assembled ProposalParts via ProtobufCodec; checks faithful round trip, byte-stable re-encoding,
  // and unchanged to_sign_bytes. capIters keeps the flow fast (each iteration checks a whole multi-part stream).
  { repo: "circlefin/arc-node", leadId: "node-proposal-stream", property: "proposal_stream_roundtrip_faithful", crate: "arc-consensus-types", testName: "shakuni_proposal_stream", srcFile: "arcnode_proposal_stream.rs", destRel: "crates/types/tests/shakuni_proposal_stream.rs", capIters: 30_000 }, // SHAKUNI ADDITION
];

export function harnessForLead(leadId: string): HarnessDef | undefined {
  return HARNESSES.find((h) => h.leadId === leadId);
}

export function harnessesForRepo(repo: string): HarnessDef[] {
  return HARNESSES.filter((h) => h.repo.toLowerCase() === repo.toLowerCase());
}

/** Back-compat alias. */
export const MALACHITE_HARNESSES = harnessesForRepo("circlefin/malachite");