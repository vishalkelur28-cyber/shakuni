import PageHeader from "../../components/PageHeader";
import ForgeHarness from "../../components/ForgeHarness";

export default function ForgeHarnessPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Foundry PoC Harness"
        description="Write a Foundry test, run it with forge, and capture a reproducible proof of concept, the report-grade artifact every program wants. Unit tests run locally; fork tests are testnet-only."
      />
      <div className="mt-8">
        <ForgeHarness />
      </div>
    </div>
  );
}
