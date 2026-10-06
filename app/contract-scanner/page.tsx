import PageHeader from "../../components/PageHeader";
import ContractScanner from "../../components/ContractScanner";

export default function ContractScannerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Contract Scanner"
        description="Heuristic vuln-pattern scan for Solidity, Rust, Move, Cairo, Go and JS, plus the per-asset methodology checklists. Runs offline in your browser, no Linux, no external scanner. Patterns are leads; the built-in triage keeps false positives out of your reports."
      />
      <div className="mt-8">
        <ContractScanner />
      </div>
    </div>
  );
}
