import PageHeader from "../../components/PageHeader";
import KnowledgeBase from "../../components/KnowledgeBase";

export default function KnowledgeBasePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Knowledge Base"
        description="A searchable reference across every major ethical-hacking and bug-bounty domain, web, API, web3, mobile, network, cloud, binary, auth, recon, plus per-language pitfalls, a methodology, and a tool catalog mapping external tools to Shakuni's in-house equivalents. Leads and references for authorized testing only."
      />
      <div className="mt-8">
        <KnowledgeBase />
      </div>
    </div>
  );
}
