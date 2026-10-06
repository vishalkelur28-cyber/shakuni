import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { Stat } from "../../components/ui";
import { blockchainProfiles } from "../../lib/blockchain/registry";
import { languageRegistry } from "../../lib/languages/registry";
import { coreInvariants } from "../../lib/security/registry";

export default function ResearchDashboard() {
  return (
    <div>
      <PageHeader
        step="registry"
        eyebrow="Research registry"
        title="Chains, languages and invariants"
        description="The reference frame for every hypothesis. Check which chains, languages and security properties apply to your target before opening Deep Research."
      />

      <div className="stat-grid mt-8">
        <Stat label="Blockchain profiles" value={blockchainProfiles.length} />
        <Stat label="Languages and configs" value={languageRegistry.length} />
        <Stat label="Core invariants" value={coreInvariants.length} />
        <Stat label="Research domains" value={<Link href="/crypto" className="text-accent underline-offset-4 hover:underline">Browse</Link>} />
      </div>

      <section className="card card-p mt-6">
        <h2 className="h2">Language intelligence</h2>
        <p className="mt-1 text-sm text-gray-500">What Shakuni can plan analysis for.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {languageRegistry.map((language) => <span key={language.id} className="chip">{language.name}</span>)}
        </div>
      </section>

      <section className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="card card-p">
          <h2 className="h2">Blockchain profiles</h2>
          <p className="mt-1 text-sm text-gray-500">Components and attack surfaces per ecosystem.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {blockchainProfiles.map((profile) => (
              <li key={profile.id} className="well p-3">
                <p className="font-medium">{profile.name}</p>
                <p className="mt-1 text-xs text-gray-500">{profile.components.length} components · {profile.surfaces.length} surfaces</p>
              </li>
            ))}
          </ul>
          <p className="muted mt-4 border-t border-white/[.06] pt-4">Circle coverage includes USDC, CCTP V2, Gateway, wallets, contracts, Paymaster, APIs, webhooks, attestations and Arc integration.</p>
        </div>

        <div className="card card-p">
          <h2 className="h2">Security invariants</h2>
          <p className="mt-1 text-sm text-gray-500">Properties that must always hold.</p>
          <ul className="mt-4 space-y-3">
            {coreInvariants.map((invariant) => (
              <li key={invariant.id} className="well p-3">
                <p className="font-mono text-[11px] text-green-400">{invariant.id}</p>
                <p className="mt-1 text-sm">{invariant.statement}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
