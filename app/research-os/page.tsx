import PageHeader from "../../components/PageHeader";
import ControlPlane from "../../components/ControlPlane";
import { SHAKUNI_CAPABILITIES } from "../../lib/intelligence/shakuni-os";

export default function ResearchOSPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Research control plane"
        description="One evidence graph connecting bounty scope, ArchSetu understanding, GitHub history, hypotheses, experiments, learning and reports. Every capability carries its own safety boundary."
      />
      <div className="mt-8">
        <ControlPlane capabilities={SHAKUNI_CAPABILITIES} />
      </div>
    </div>
  );
}
