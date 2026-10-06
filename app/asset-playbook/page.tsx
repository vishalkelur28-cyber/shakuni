import PageHeader from "../../components/PageHeader";
import AssetPlaybook from "../../components/AssetPlaybook";

export default function AssetPlaybookPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Asset Playbook"
        description="For every HackerOne asset type (Source Code, API, Smart Contract, AI Model, Domain, Mobile, Binary, Cloud, Hardware and the rest): what to do, what to look for, and honestly how much Shakuni handles versus what needs you or an external tool."
      />
      <div className="mt-8">
        <AssetPlaybook />
      </div>
    </div>
  );
}
