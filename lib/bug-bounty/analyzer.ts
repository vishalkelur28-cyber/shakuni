import { BountyAsset, BountyProgramProfile } from "./types";

const truthy = new Set(["true", "yes", "y", "1", "eligible", "in scope"]);
const falsy = new Set(["false", "no", "n", "0", "ineligible", "out of scope"]);

function parseBool(value?: string): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (truthy.has(normalized)) return true;
  if (falsy.has(normalized)) return false;
  return null;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (c === ',' && !quoted) { out.push(cell.trim()); cell = ""; continue; }
    cell += c;
  }
  out.push(cell.trim());
  return out;
}

export function parseScopeCsv(text: string): BountyAsset[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  const find = (...names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;
  const identifierIndex = find("asset_identifier", "identifier", "asset", "url", "domain", "handle");
  const typeIndex = find("asset_type", "type", "asset_type_name");
  const bountyIndex = find("eligible_for_bounty", "bounty_eligible", "bounty");
  const submissionIndex = find("eligible_for_submission", "submission_eligible", "in_scope", "scope");
  const instructionIndex = find("instruction", "instructions", "details", "description");
  const labelsIndex = find("asset_labels", "labels", "tags", "asset_tags");

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((header, i) => { raw[header] = values[i] ?? ""; });
    const identifier = identifierIndex >= 0 ? values[identifierIndex] ?? "" : "";
    return {
      identifier,
      assetType: typeIndex >= 0 ? values[typeIndex] ?? "Other" : "Other",
      eligibleForBounty: bountyIndex >= 0 ? parseBool(values[bountyIndex]) : null,
      eligibleForSubmission: submissionIndex >= 0 ? parseBool(values[submissionIndex]) : null,
      instruction: instructionIndex >= 0 ? values[instructionIndex] ?? "" : "",
      labels: labelsIndex >= 0 ? (values[labelsIndex] ?? "").split(/[;,|]/).map((x) => x.trim()).filter(Boolean) : [],
      raw,
    };
  }).filter((asset) => asset.identifier || asset.instruction);
}

export function analyzeProgram(input: {
  name: string;
  source: string;
  csvText: string;
  policyText: string;
}): BountyProgramProfile {
  const assets = parseScopeCsv(input.csvText);
  const policy = input.policyText;
  const lower = policy.toLowerCase();
  const exclusions = policy.split(/\r?\n/).filter((line) => /out of scope|not eligible|excluded|ineligible|do not test|prohibited/i.test(line)).slice(0, 30);
  const requirements = policy.split(/\r?\n/).filter((line) => /must|require|only|report|reproduce|safe harbor|authorization|disclosure/i.test(line)).slice(0, 30);
  const technologies = Array.from(new Set([
    ...assets.flatMap((a) => a.labels),
    ...(lower.match(/\b(solidity|rust|go|typescript|javascript|python|java|c\+\+|cairo|move|kubernetes|docker|aws|gcp|azure|graphql|grpc|rest|ethereum|bitcoin|cosmos|arc|usdc|cctp)\b/gi) ?? []),
  ])).slice(0, 40);
  const repositories = Array.from(new Set((policy.match(/https?:\/\/[^\s)]+|github\.com\/[\w.-]+\/[\w.-]+/gi) ?? []).filter((x) => /github/i.test(x))));
  const warnings: string[] = [];
  if (!assets.length) warnings.push("No scope assets were parsed. Upload a scope/asset CSV before starting research.");
  if (assets.some((a) => a.eligibleForSubmission === false)) warnings.push("Some assets are explicitly ineligible for submission.");
  if (assets.some((a) => a.eligibleForBounty === false)) warnings.push("Some assets are not bounty-eligible; bounty eligibility must not be inferred from technical scope.");
  if (!policy.trim()) warnings.push("No program policy was supplied. Research authorization and exclusions cannot be verified.");
  if (!/safe harbor|authorization|rules|scope/i.test(policy)) warnings.push("Policy text does not clearly expose an authorization/safe-harbor section.");
  const scopeMode = /open scope|open-scoped|any asset.*owned/i.test(lower) ? "open" : assets.length ? "defined" : "unknown";
  return { name: input.name || "Imported Bug Bounty Program", source: input.source, scopeMode, policyText: policy, assets, exclusions, technologies, repositories, requirements, warnings };
}
