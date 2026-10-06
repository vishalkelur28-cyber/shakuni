import PageHeader from "../../components/PageHeader";
import CryptoExplorer from "../../components/CryptoExplorer";
import { CRYPTO_RESEARCH_DOMAINS, UNIVERSAL_BLOCKCHAIN_CHECKLIST } from "../../lib/blockchain/crypto-domains";

export default function CryptoResearchPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Blockchain research universe"
        description="Protocol-specific research surfaces for chains, smart contracts, bridges, wallets, DeFi, consensus, cryptography and infrastructure."
      />
      <div className="mt-8">
        <CryptoExplorer domains={CRYPTO_RESEARCH_DOMAINS} dimensions={UNIVERSAL_BLOCKCHAIN_CHECKLIST} />
      </div>
    </div>
  );
}
