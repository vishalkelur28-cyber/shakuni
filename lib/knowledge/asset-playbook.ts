// Per-asset-type playbook covering every HackerOne asset type: what it is, how to
// approach it, what to look for, the tools to use (in-house + external), and an
// honest fit rating for how much Shakuni can do versus what needs you or a tool.

export type Fit = "autonomous" | "copilot" | "static" | "external" | "avoid";

export interface FitMeta { id: Fit; label: string; color: string; meaning: string }

export const FITS: FitMeta[] = [
  { id: "autonomous", label: "Shakuni drives", color: "#53c18b", meaning: "Shakuni does most of the work in-house; you review and submit." },
  { id: "copilot", label: "You + Shakuni", color: "#8fb0ff", meaning: "Shakuni analyzes and scripts; you run the live/browser steps." },
  { id: "static", label: "Static only", color: "#e0a94a", meaning: "Shakuni reads/decompiles the code; dynamic testing needs a device/runtime." },
  { id: "external", label: "Needs external tools", color: "#d98b5f", meaning: "The core work needs tools/hardware outside Shakuni." },
  { id: "avoid", label: "Low fit", color: "#c0557a", meaning: "Out of this setup's lane (risk, hardware, or platform you don't have)." },
];

export const FIT: Record<Fit, FitMeta> = Object.fromEntries(FITS.map((f) => [f.id, f])) as Record<Fit, FitMeta>;

// href = an in-house Shakuni page; get = how to obtain/run an external tool.
export interface Tool { name: string; purpose: string; href?: string; get?: string }

export interface AssetPlay {
  id: string;
  name: string;
  fit: Fit;
  what: string;
  approach: string[];
  lookFor: string;
  tools: Tool[];
  needs?: string;
}

export const ASSETS: AssetPlay[] = [
  {
    id: "source", name: "Source Code", fit: "autonomous",
    what: "A public or provided code repository is in scope. The strongest lane: read the code, find the bug, prove it.",
    approach: [
      "Clone and map the repo; in a multi-repo program, map how they connect.",
      "Run the pattern scanner, then the AST analyzer; triage every lead.",
      "Work the per-asset methodology checklist for the real invariants.",
      "Reproduce with a PoC, dedup against issues/PRs, then write the report.",
    ],
    lookFor: "Logic and auth flaws, injection, unsafe deserialization, secrets, insecure crypto, broken access control.",
    tools: [
      { name: "Repo Atlas", purpose: "map how a program's repos connect", href: "/repo-atlas" },
      { name: "Contract Scanner", purpose: "regex vuln patterns + methodology", href: "/contract-scanner" },
      { name: "Solidity Analyzer", purpose: "AST detectors (Solidity)", href: "/solc-analyzer" },
      { name: "Prior-Art Checker", purpose: "dedup against issues/PRs", href: "/dedup-checker" },
      { name: "Report Builder", purpose: "write the report", href: "/report-builder" },
      { name: "Semgrep", purpose: "multi-language taint/SAST rules", get: "pip install semgrep; semgrep --config auto ." },
      { name: "CodeQL", purpose: "deep dataflow queries", get: "github.com/github/codeql-cli-binaries" },
      { name: "gitleaks / trufflehog", purpose: "secret scanning (incl. git history)", get: "github.com/gitleaks/gitleaks" },
    ],
  },
  {
    id: "contract", name: "Smart Contract", fit: "autonomous",
    what: "On-chain contracts (Solidity/Rust/Move/Cairo). The money is in the logic.",
    approach: [
      "Read the contracts; identify the trust boundaries and money paths.",
      "Scan (regex + solc AST) and work the contract / bridge / token / gateway checklists.",
      "Craft and verify signatures and messages; reason about replay and domain binding.",
      "Reproduce with a forked Foundry invariant/unit test; verify against the default branch.",
    ],
    lookFor: "Reentrancy, access control, signature replay/malleability, bridge/attestation flaws, oracle manipulation, overflow, unprotected init/upgrade.",
    tools: [
      { name: "Contract Scanner", purpose: "pattern scan + invariant checklists", href: "/contract-scanner" },
      { name: "Solidity Analyzer", purpose: "AST detectors via solc", href: "/solc-analyzer" },
      { name: "Chain Lab", purpose: "RPC reads + craft/verify signatures", href: "/chain-lab" },
      { name: "Foundry PoC Harness", purpose: "run forge test/fuzz to prove it", href: "/forge-harness" },
      { name: "Slither", purpose: "mature Solidity static detectors", get: "pip install slither-analyzer; slither ." },
      { name: "Mythril", purpose: "symbolic execution", get: "pip install mythril; myth analyze <file>" },
      { name: "Echidna / Medusa", purpose: "property-based fuzzing", get: "github.com/crytic/echidna" },
    ],
  },
  {
    id: "api", name: "API", fit: "autonomous",
    what: "A REST or GraphQL API is in scope. Logic/authz bugs are common and findable.",
    approach: [
      "Read the API docs / OpenAPI spec; enumerate endpoints and object IDs.",
      "Create two of your own accounts; run the cross-tenant IDOR matrix.",
      "Test auth (JWT), mass assignment, excessive data exposure, rate limits, GraphQL introspection.",
      "Keep it non-destructive; sandbox/testnet per the program rules.",
    ],
    lookFor: "BOLA/IDOR, broken object-property-level auth, JWT flaws, mass assignment, missing authz, data over-exposure.",
    tools: [
      { name: "Request Workbench", purpose: "repeater + cross-tenant IDOR matrix", href: "/request-workbench" },
      { name: "Knowledge Base (API)", purpose: "the API vuln classes", href: "/knowledge-base" },
      { name: "Burp Suite / Caido", purpose: "intercept, repeat, scan", get: "portswigger.net/burp" },
      { name: "Postman / Insomnia", purpose: "build and replay API requests", get: "postman.com" },
      { name: "jwt_tool", purpose: "JWT tampering/attacks", get: "github.com/ticarpi/jwt_tool" },
      { name: "Arjun", purpose: "hidden parameter discovery", get: "pip install arjun" },
    ],
    needs: "Your own API keys/accounts in the program's sandbox.",
  },
  {
    id: "ai", name: "AI Model", fit: "autonomous",
    what: "An LLM or AI feature is in scope. A fast-growing, reasoning-heavy category.",
    approach: [
      "Map the model's capabilities, tools, and data access (what it can read/do).",
      "Test prompt injection that crosses a real boundary (tool abuse, data exfil, privilege change), not toy jailbreaks.",
      "Probe for training-data/secret leakage and unsafe tool/plugin invocation.",
      "Show concrete impact (another user's data, an unauthorized action), not just a refusal bypass.",
    ],
    lookFor: "Account-impact prompt injection, indirect injection via content, tool/function abuse, data exfiltration, insecure output handling.",
    tools: [
      { name: "Knowledge Base", purpose: "AI/LLM attack reference", href: "/knowledge-base" },
      { name: "Request Workbench", purpose: "hit the model API directly", href: "/request-workbench" },
      { name: "garak", purpose: "LLM vulnerability scanner", get: "pip install garak" },
      { name: "promptfoo", purpose: "prompt-injection test harness", get: "npx promptfoo@latest" },
      { name: "PyRIT", purpose: "AI red-teaming framework", get: "github.com/Azure/PyRIT" },
    ],
    needs: "Access to the model/endpoint; stay in scope.",
  },
  {
    id: "domain", name: "Domain", fit: "copilot",
    what: "A specific web domain is in scope. Classic web-app testing.",
    approach: [
      "Recon the host: content/parameter discovery, tech fingerprinting.",
      "Map the app and auth flows; test the OWASP classes.",
      "Use the repeater for craft-and-replay; capture evidence.",
    ],
    lookFor: "XSS, SQLi, SSRF, IDOR, auth bypass, CSRF, business logic, access control.",
    tools: [
      { name: "Request Workbench", purpose: "repeater + IDOR for the app", href: "/request-workbench" },
      { name: "Knowledge Base (web)", purpose: "web vuln classes + payloads", href: "/knowledge-base" },
      { name: "Burp Suite / Caido", purpose: "intercept, repeat, scan, intrude", get: "portswigger.net/burp" },
      { name: "ffuf", purpose: "content/parameter fuzzing", get: "github.com/ffuf/ffuf" },
      { name: "nuclei", purpose: "template-based vuln scanning", get: "github.com/projectdiscovery/nuclei" },
      { name: "sqlmap", purpose: "SQL injection", get: "github.com/sqlmapproject/sqlmap" },
    ],
  },
  {
    id: "wildcard", name: "Wildcard (*.domain)", fit: "copilot",
    what: "Every subdomain of a domain is in scope. The widest web surface.",
    approach: [
      "Enumerate subdomains broadly (passive + active), then probe which are live.",
      "Prioritize forgotten/dev/staging hosts and subdomain-takeover candidates.",
      "Then test each like a Domain asset.",
    ],
    lookFor: "Subdomain takeover, forgotten apps with weak controls, plus all the Domain classes.",
    tools: [
      { name: "Request Workbench", purpose: "test the live hosts", href: "/request-workbench" },
      { name: "subfinder / amass", purpose: "subdomain enumeration", get: "github.com/projectdiscovery/subfinder" },
      { name: "httpx", purpose: "probe live hosts", get: "github.com/projectdiscovery/httpx" },
      { name: "nuclei", purpose: "mass vuln + takeover templates", get: "github.com/projectdiscovery/nuclei" },
      { name: "dnsx", purpose: "DNS resolution/brute", get: "github.com/projectdiscovery/dnsx" },
    ],
  },
  {
    id: "ip", name: "IP Address", fit: "copilot",
    what: "A specific host IP is in scope. Network + service testing.",
    approach: [
      "Scan ports/services and version-detect.",
      "Test exposed web services with the repeater; check default creds and known-vuln versions.",
      "Be careful: live infra, so no volumetric or disruptive testing.",
    ],
    lookFor: "Exposed/outdated services, default credentials, misconfig, web services on non-standard ports.",
    tools: [
      { name: "Request Workbench", purpose: "test HTTP services on the host", href: "/request-workbench" },
      { name: "Knowledge Base (network)", purpose: "network checks", href: "/knowledge-base" },
      { name: "nmap", purpose: "port/service scan + scripts", get: "nmap.org (nmap -sV -sC target)" },
      { name: "nuclei", purpose: "known-vuln checks", get: "github.com/projectdiscovery/nuclei" },
    ],
  },
  {
    id: "cidr", name: "CIDR", fit: "copilot",
    what: "An IP range is in scope. Breadth-first network recon, then per-host testing.",
    approach: [
      "Sweep the range for live hosts and open services.",
      "Triage to the interesting hosts (web apps, admin panels, outdated services).",
      "Then treat each like an IP Address asset, carefully and non-disruptively.",
    ],
    lookFor: "Exposed services, host takeover, default creds, misconfigured infra.",
    tools: [
      { name: "Request Workbench", purpose: "test the HTTP findings", href: "/request-workbench" },
      { name: "nmap / masscan", purpose: "range sweep", get: "nmap.org (mind rate + scope)" },
      { name: "httpx + nuclei", purpose: "probe then scan at scale", get: "github.com/projectdiscovery" },
    ],
  },
  {
    id: "android-apk", name: "Android: .apk", fit: "static",
    what: "An Android app binary. Shakuni can read the decompiled code (static); dynamic needs a device.",
    approach: [
      "Decompile the APK and read the sources + manifest.",
      "Static: hardcoded secrets, exported components, insecure storage, WebView config, cert pinning.",
      "Dynamic (device/emulator): hook with Frida, intercept the API, test the exposed backend.",
    ],
    lookFor: "Hardcoded secrets (verify they're live, not test keys), exported Activities/Providers, insecure storage, deep-link/WebView issues, and the backend API.",
    tools: [
      { name: "Contract Scanner", purpose: "grep the decompiled code for patterns/secrets", href: "/contract-scanner" },
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "jadx", purpose: "decompile APK to Java", get: "github.com/skylot/jadx" },
      { name: "apktool", purpose: "unpack resources + smali", get: "apktool.org" },
      { name: "MobSF", purpose: "automated mobile static analysis", get: "github.com/MobSF/Mobile-Security-Framework-MobSF" },
      { name: "Frida / objection", purpose: "runtime hooking (needs device)", get: "frida.re; pip install objection" },
    ],
  },
  {
    id: "android-play", name: "Android: Play Store", fit: "static",
    what: "A published Android app. Pull the APK, then same as the .apk asset.",
    approach: [
      "Obtain the APK, decompile, and read it (static).",
      "Focus static effort on secrets, exported components, and the backend API.",
      "Dynamic testing needs a device/emulator.",
    ],
    lookFor: "Same as Android .apk: secrets, IPC exposure, insecure storage, backend API flaws.",
    tools: [
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "jadx / apktool", purpose: "decompile and unpack", get: "github.com/skylot/jadx" },
      { name: "MobSF", purpose: "static analysis report", get: "github.com/MobSF/Mobile-Security-Framework-MobSF" },
      { name: "apkleaks", purpose: "find secrets/endpoints in the APK", get: "github.com/dwisiswant0/apkleaks" },
    ],
  },
  {
    id: "executable", name: "Executable", fit: "static",
    what: "A desktop/native binary. Reverse engineering; Shakuni can review decompiled output (static).",
    approach: [
      "Disassemble/decompile the binary and read the logic.",
      "Identify input handling and dangerous calls; look for memory-safety and logic bugs.",
      "Dynamic analysis/debugging to confirm needs the runtime.",
    ],
    lookFor: "Memory corruption (overflow, UAF), format strings, insecure IPC/update, hardcoded secrets, auth logic.",
    tools: [
      { name: "Knowledge Base (binary)", purpose: "pwn/RE reference", href: "/knowledge-base" },
      { name: "Ghidra", purpose: "free decompiler/disassembler", get: "ghidra-sre.org" },
      { name: "IDA / Binary Ninja", purpose: "commercial RE suites", get: "hex-rays.com" },
      { name: "radare2 / Cutter", purpose: "open-source RE", get: "rada.re" },
      { name: "gdb + pwndbg", purpose: "dynamic debugging", get: "github.com/pwndbg/pwndbg" },
    ],
  },
  {
    id: "ios-ipa", name: "iOS: .ipa", fit: "static",
    what: "An iOS app binary. Limited static review is possible; most iOS work needs a Mac + device.",
    approach: [
      "Unzip the IPA and read the Info.plist, strings, and any readable assets (static).",
      "Full analysis usually needs decryption on a jailbroken device and Frida.",
    ],
    lookFor: "Hardcoded secrets, insecure URL schemes, ATS exceptions, and the backend API.",
    tools: [
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "class-dump / otool", purpose: "inspect the binary (macOS)", get: "macOS developer tools" },
      { name: "Hopper", purpose: "decompiler", get: "hopperapp.com" },
      { name: "Frida / objection", purpose: "runtime (needs jailbroken device)", get: "frida.re" },
      { name: "MobSF", purpose: "iOS static analysis", get: "github.com/MobSF/Mobile-Security-Framework-MobSF" },
    ],
  },
  {
    id: "ios-appstore", name: "iOS: App Store", fit: "external",
    what: "A published iOS app. Testing needs a Mac and (usually) a jailbroken device.",
    approach: [
      "Acquire and decrypt the app on a device, then static + dynamic analysis.",
      "Shakuni's realistic contribution is the backend API it talks to.",
    ],
    lookFor: "Insecure storage, pinning bypass, URL-scheme/deep-link issues, and backend API flaws.",
    tools: [
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "frida-ios-dump", purpose: "decrypt the app on-device", get: "github.com/AloneMonkey/frida-ios-dump" },
      { name: "objection / Frida", purpose: "runtime analysis", get: "pip install objection" },
    ],
  },
  {
    id: "ios-testflight", name: "iOS: TestFlight", fit: "external",
    what: "A pre-release iOS build via TestFlight. Same constraints as App Store iOS.",
    approach: [
      "Install via TestFlight on a device; analyze on-device.",
      "Shakuni helps with the backend API; the app itself needs iOS tooling.",
    ],
    lookFor: "Same as iOS App Store, plus pre-release debug features/endpoints.",
    tools: [
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "objection / Frida", purpose: "on-device runtime analysis", get: "pip install objection" },
    ],
  },
  {
    id: "windows-store", name: "Windows: Microsoft Store", fit: "external",
    what: "A packaged Windows app (MSIX/UWP). Niche; needs Windows app tooling (you're on Windows).",
    approach: [
      "Unpack the package and review; analyze the app's logic and IPC.",
      "Shakuni helps with any backend API and static review of readable code.",
    ],
    lookFor: "Insecure update, privilege issues, insecure IPC, hardcoded secrets, backend API.",
    tools: [
      { name: "Request Workbench", purpose: "test the backend API", href: "/request-workbench" },
      { name: "dnSpy / ILSpy", purpose: ".NET decompilation", get: "github.com/dnSpyEx/dnSpy" },
      { name: "Process Monitor", purpose: "observe file/registry/IPC", get: "Sysinternals (learn.microsoft.com)" },
    ],
  },
  {
    id: "hardware", name: "Hardware", fit: "avoid",
    what: "A physical device is in scope. Needs the hardware and specialized equipment/skills.",
    approach: [
      "Requires the device, lab gear (logic analyzer, JTAG/UART, chip tools), and firmware extraction.",
      "If firmware is obtainable, Shakuni can statically review it like an Executable.",
    ],
    lookFor: "Firmware secrets, insecure boot/update, exposed debug interfaces, crypto implementation flaws.",
    tools: [
      { name: "binwalk", purpose: "extract/analyze firmware images", get: "github.com/ReFirmLabs/binwalk" },
      { name: "Ghidra", purpose: "reverse the extracted firmware", get: "ghidra-sre.org" },
      { name: "Lab gear", purpose: "logic analyzer, JTAGulator, bus tools", get: "physical equipment" },
    ],
  },
  {
    id: "aws", name: "AWS Account", fit: "avoid",
    what: "A cloud account/environment is in scope. High-risk: live infra, credentials, strict scope.",
    approach: [
      "Only with provided test credentials and explicit authorization.",
      "Enumerate permissions, look for privilege-escalation paths and exposed resources.",
      "Chain an app SSRF to the instance metadata service where in scope.",
    ],
    lookFor: "IAM privilege escalation, public/writable S3 buckets, SSRF-to-metadata (IMDS) credential theft, exposed secrets.",
    tools: [
      { name: "Knowledge Base (cloud)", purpose: "cloud attack reference", href: "/knowledge-base" },
      { name: "Request Workbench", purpose: "drive an SSRF-to-metadata chain", href: "/request-workbench" },
      { name: "pacu", purpose: "AWS exploitation framework", get: "github.com/RhinoSecurityLabs/pacu" },
      { name: "ScoutSuite", purpose: "multi-cloud misconfig audit", get: "github.com/nccgroup/ScoutSuite" },
      { name: "cloudsplaining", purpose: "IAM policy risk analysis", get: "github.com/salesforce/cloudsplaining" },
    ],
  },
  {
    id: "azure", name: "Azure Account", fit: "avoid",
    what: "An Azure environment is in scope. Same high-risk profile as AWS.",
    approach: [
      "Only with test credentials and authorization.",
      "Enumerate roles/permissions; look for misconfig and escalation; check metadata (IMDS) via SSRF where in scope.",
    ],
    lookFor: "Azure RBAC misconfig, storage account exposure, managed-identity abuse, SSRF-to-metadata.",
    tools: [
      { name: "Knowledge Base (cloud)", purpose: "cloud attack reference", href: "/knowledge-base" },
      { name: "ScoutSuite", purpose: "misconfig audit", get: "github.com/nccgroup/ScoutSuite" },
      { name: "MicroBurst", purpose: "Azure attack toolkit", get: "github.com/NetSPI/MicroBurst" },
      { name: "ROADtools", purpose: "Entra ID enumeration", get: "github.com/dirkjanm/ROADtools" },
    ],
  },
  {
    id: "other", name: "Other Asset", fit: "copilot",
    what: "A catch-all. Read the program's specific instructions; the approach follows the real underlying tech.",
    approach: [
      "Identify what the asset actually is (a protocol, a binary, a service, a doc).",
      "Map it to the nearest asset type above and apply that playbook.",
    ],
    lookFor: "Whatever the underlying technology exposes; the program's notes usually say what they care about.",
    tools: [
      { name: "Knowledge Base", purpose: "find the matching domain + tools", href: "/knowledge-base" },
      { name: "Request Workbench", purpose: "for any HTTP/API surface", href: "/request-workbench" },
    ],
  },
];
