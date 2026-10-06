import PageHeader from "../../components/PageHeader";
import DedupChecker from "../../components/DedupChecker";

export default function DedupCheckerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Prior-Art Checker"
        description="Search a repository's issues and pull requests for your finding before you report it, a duplicate costs the payout and your signal. Set GITHUB_TOKEN in the environment to raise the rate limit."
      />
      <div className="mt-8">
        <DedupChecker />
      </div>
    </div>
  );
}
