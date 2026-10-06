import PageHeader from "../../components/PageHeader";
import ChainLab from "../../components/ChainLab";

export default function ChainLabPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Chain Lab"
        description="Read on-chain state from any testnet RPC, and craft or verify the cryptography behind attestations, keccak256, ECDSA sign/recover, and EIP-712 digests. Testnet and test keys only."
      />
      <div className="mt-8">
        <ChainLab />
      </div>
    </div>
  );
}
