import PageHeader from "../../components/PageHeader";
import SolcAnalyzer from "../../components/SolcAnalyzer";

export default function SolcAnalyzerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Solidity Analyzer"
        description="Compile Solidity with solc and run AST-level detectors, structural, not regex, so comments and strings never trigger a false positive and function-level checks (initializer/upgrade guards, visibility) are exact. Runs locally."
      />
      <div className="mt-8">
        <SolcAnalyzer />
      </div>
    </div>
  );
}
