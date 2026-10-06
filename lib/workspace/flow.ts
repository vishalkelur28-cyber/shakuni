export type StepId = "intake" | "analysis" | "github" | "registry" | "research" | "readiness";

export interface FlowStep {
  id: StepId;
  n: number;
  href: string;
  title: string;
  short: string;
  blurb: string;
}

/** The one canonical research workflow. Order here is the order users see everywhere. */
export const FLOW_STEPS: FlowStep[] = [
  { id: "intake", n: 1, href: "/bug-bounty", title: "Program Intake", short: "Intake", blurb: "Import scope CSV and policy. Establish what is in scope and what rules apply." },
  { id: "analysis", n: 2, href: "/external-analysis", title: "Repository Analysis", short: "Analysis", blurb: "Bring in ArchSetu or other static-analysis output as research context." },
  { id: "github", n: 3, href: "/github-intelligence", title: "GitHub Evidence", short: "GitHub", blurb: "Pull PRs, reviews and issues to learn what changed and what is already known." },
  { id: "registry", n: 4, href: "/research", title: "Research Registry", short: "Registry", blurb: "Chains, languages and invariants that frame the hypotheses." },
  { id: "research", n: 5, href: "/deep-research", title: "Deep Research", short: "Research", blurb: "Branch, experiment, record evidence and counterexamples under the safety gates." },
  { id: "readiness", n: 6, href: "/arc-readiness", title: "Readiness Gate", short: "Readiness", blurb: "Check which capabilities have verified evidence before anything is reported." },
];

export interface ReferencePage {
  href: string;
  title: string;
  blurb: string;
}

export const REFERENCE_PAGES: ReferencePage[] = [
  { href: "/constitution", title: "Constitution", blurb: "Rules that govern research, disproof and learning." },
  { href: "/research-os", title: "Control Plane", blurb: "Every capability in the research OS and its safety boundary." },
  { href: "/intelligence", title: "Intelligence Engine", blurb: "Parallel research perspectives and convergence rules." },
  { href: "/crypto", title: "Crypto Universe", blurb: "Protocol-specific research domains and invariants." },
  { href: "/knowledge-base", title: "Knowledge Base", blurb: "Searchable reference across every hacking domain, language, payload, method and tool." },
  { href: "/asset-playbook", title: "Asset Playbook", blurb: "Every HackerOne asset type: what to do, and how much Shakuni handles in-house." },
  { href: "/repo-atlas", title: "Repo Atlas", blurb: "Map how a program's repositories connect, plain and technical, up to 30 repos." },
];

export const TOOL_PAGES: ReferencePage[] = [
  { href: "/autonomous", title: "Autonomous hunt", blurb: "Pick one in-scope target; the engine proves its pipeline and produces cross-referenced leads." },
  { href: "/contract-scanner", title: "Contract Scanner", blurb: "Offline vuln-pattern scan + per-asset methodology checklists. No external tools." },
  { href: "/solc-analyzer", title: "Solidity Analyzer", blurb: "AST-level Solidity detectors via solc, structural, not regex." },
  { href: "/forge-harness", title: "Foundry PoC Harness", blurb: "Write and run a forge test to capture a reproducible proof of concept." },
  { href: "/request-workbench", title: "Request Workbench", blurb: "Burp-style HTTP repeater, Intruder fuzzer + cross-tenant IDOR matrix." },
  { href: "/recon", title: "Recon Suite", blurb: "Subdomains, DNS, host probe, content discovery, wayback. Replaces subfinder/dnsx/httpx/ffuf/gau." },
  { href: "/decoder", title: "Decoder", blurb: "Base64/URL/Hex/HTML/JWT/hash encode-decode. The Burp Decoder." },
  { href: "/comparer", title: "Comparer", blurb: "Line-by-line diff of two responses or payloads. The Burp Comparer." },
  { href: "/chain-lab", title: "Chain Lab", blurb: "Testnet RPC reads + attestation crypto (keccak, ECDSA sign/recover, EIP-712)." },
  { href: "/dedup-checker", title: "Prior-Art Checker", blurb: "Search a repo's issues/PRs for your finding before reporting, avoid duplicates." },
  { href: "/report-builder", title: "Report Builder", blurb: "Turn a verified finding into a clean, reproducible HackerOne report." },
  { href: "/terminal", title: "Terminal", blurb: "Run arc-forge, arc-anvil, cast, git and npm inside Shakuni, on this machine only." },
];

export function stepForPath(pathname: string): FlowStep | undefined {
  return FLOW_STEPS.find((s) => pathname === s.href || pathname.startsWith(s.href + "/"));
}
