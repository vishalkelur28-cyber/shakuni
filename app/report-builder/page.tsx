import PageHeader from "../../components/PageHeader";
import ReportBuilder from "../../components/ReportBuilder";

export default function ReportBuilderPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Report Builder"
        description="Turn a verified finding into a clean, reproducible HackerOne-style report: steps, a working PoC, honest impact, and a dedup note. Live Markdown preview, one-click copy."
      />
      <div className="mt-8">
        <ReportBuilder />
      </div>
    </div>
  );
}
