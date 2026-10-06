import PageHeader from "../../components/PageHeader";
import Comparer from "../../components/Comparer";

export default function ComparerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Comparer"
        description="Diff two responses or payloads line by line to spot what changed, like Burp's Comparer. Runs in your browser."
      />
      <div className="mt-8">
        <Comparer />
      </div>
    </div>
  );
}
