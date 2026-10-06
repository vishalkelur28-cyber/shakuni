import PageHeader from "../../components/PageHeader";
import RequestWorkbench from "../../components/RequestWorkbench";

export default function RequestWorkbenchPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Tool"
        title="Request Workbench"
        description="A focused Burp-style repeater and cross-tenant IDOR runner for the web2 scope. Requests are sent from this machine (no browser CORS), with raw status, headers and redirects visible. Authorized testing on sandbox/testnet only."
      />
      <div className="mt-8">
        <RequestWorkbench />
      </div>
    </div>
  );
}
