import PageHeader from "../../components/PageHeader";
import Recon from "../../components/Recon";

export default function ReconPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Recon Suite"
        description="Web recon in-house: passive subdomain enumeration, DNS records, host probing, content discovery, and historical URLs. Replaces the common uses of subfinder, dnsx, httpx, ffuf and gau. Authorized, in-scope targets only."
      />
      <div className="mt-8">
        <Recon />
      </div>
    </div>
  );
}
