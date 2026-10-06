import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { localRequestProblem } from "../../../lib/security/local-only";

/**
 * /api/recon - web recon for the Recon suite, replacing the common uses of
 * subfinder (crt.sh), dnsx (node dns), httpx (host probe), ffuf (content
 * discovery) and gau (wayback). Local only. Authorized testing within scope.
 *
 * POST { op, domain?, url? }
 *   op=subdomains { domain }   passive subdomain enum via certificate transparency
 *   op=dns        { domain }   A/AAAA/CNAME/MX/TXT/NS records
 *   op=probe      { url }      status, server, title of a live host
 *   op=discover   { url }      fetch a built-in path wordlist, report status+length
 *   op=wayback    { domain }   historical URLs from the Wayback Machine
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORDLIST = [
  "robots.txt", "sitemap.xml", ".git/config", ".env", ".well-known/security.txt",
  "admin", "administrator", "api", "api/v1", "login", "dashboard", "config", "config.json",
  "backup", "backup.zip", ".DS_Store", "phpinfo.php", "server-status", "actuator", "actuator/health",
  "swagger.json", "swagger-ui.html", "openapi.json", "graphql", "debug", "test", "dev", "staging",
  "old", "tmp", "uploads", "status", "health", "metrics", "version", "readme.md", "CHANGELOG.md",
  "package.json", "composer.json", ".htaccess", "web.config", "wp-login.php", "user", "users", "account",
];

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await p(ac.signal); } finally { clearTimeout(t); }
}

function cleanDomain(d: string): string {
  return d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

async function subdomains(domain: string) {
  const d = cleanDomain(domain);
  const out = await withTimeout(async (signal) => {
    const res = await fetch(`https://crt.sh/?q=${encodeURIComponent("%." + d)}&output=json`, { signal, headers: { "User-Agent": "Shakuni-Research" } });
    if (!res.ok) throw new Error(`crt.sh ${res.status}`);
    return (await res.json()) as { name_value: string }[];
  }, 25_000);
  const set = new Set<string>();
  for (const row of out) for (const n of String(row.name_value || "").split("\n")) {
    const name = n.trim().toLowerCase().replace(/^\*\./, "");
    if (name.endsWith(d)) set.add(name);
  }
  return { subdomains: [...set].sort(), count: set.size };
}

async function dnsRecords(domain: string) {
  const d = cleanDomain(domain);
  const get = async (fn: () => Promise<unknown>) => { try { return await fn(); } catch { return []; } };
  const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
    get(() => dns.resolve4(d)), get(() => dns.resolve6(d)), get(() => dns.resolveCname(d)),
    get(() => dns.resolveMx(d)), get(() => dns.resolveTxt(d)), get(() => dns.resolveNs(d)),
  ]);
  return {
    A: a, AAAA: aaaa, CNAME: cname,
    MX: (mx as { exchange: string; priority: number }[]).map((m) => `${m.priority} ${m.exchange}`),
    TXT: (txt as string[][]).map((t) => t.join("")), NS: ns,
  };
}

async function probe(url: string) {
  const u = url.startsWith("http") ? url : `https://${url}`;
  return withTimeout(async (signal) => {
    const res = await fetch(u, { signal, redirect: "manual", headers: { "User-Agent": "Shakuni-Research" } });
    const body = await res.text().catch(() => "");
    const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim().slice(0, 120);
    return {
      status: res.status, server: res.headers.get("server") || "", poweredBy: res.headers.get("x-powered-by") || "",
      location: res.headers.get("location") || "", title,
    };
  }, 12_000);
}

async function discover(url: string) {
  const base = (url.startsWith("http") ? url : `https://${url}`).replace(/\/$/, "");
  const hits: { path: string; status: number; len: number }[] = [];
  for (const p of WORDLIST) {
    try {
      const r = await withTimeout(async (signal) => {
        const res = await fetch(`${base}/${p}`, { signal, redirect: "manual", headers: { "User-Agent": "Shakuni-Research" } });
        const txt = await res.text().catch(() => "");
        return { status: res.status, len: txt.length };
      }, 8_000);
      if (r.status !== 404 && r.status !== 0) hits.push({ path: p, status: r.status, len: r.len });
    } catch { /* skip */ }
    await new Promise((res) => setTimeout(res, 120)); // non-volumetric
  }
  return { hits, tested: WORDLIST.length };
}

async function wayback(domain: string) {
  const d = cleanDomain(domain);
  const out = await withTimeout(async (signal) => {
    const res = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(d)}/*&output=json&collapse=urlkey&limit=300&fl=original`, { signal, headers: { "User-Agent": "Shakuni-Research" } });
    if (!res.ok) throw new Error(`wayback ${res.status}`);
    return (await res.json()) as string[][];
  }, 20_000);
  const urls = out.slice(1).map((r) => r[0]).filter(Boolean);
  return { urls: [...new Set(urls)].slice(0, 300), count: urls.length };
}

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let b: { op?: unknown; domain?: unknown; url?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 }); }
  const op = typeof b.op === "string" ? b.op : "";
  const domain = typeof b.domain === "string" ? b.domain : "";
  const url = typeof b.url === "string" ? b.url : "";

  try {
    switch (op) {
      case "subdomains": if (!domain) throw new Error("domain required."); return NextResponse.json(await subdomains(domain));
      case "dns": if (!domain) throw new Error("domain required."); return NextResponse.json(await dnsRecords(domain));
      case "probe": if (!url) throw new Error("url required."); return NextResponse.json(await probe(url));
      case "discover": if (!url) throw new Error("url required."); return NextResponse.json(await discover(url));
      case "wayback": if (!domain) throw new Error("domain required."); return NextResponse.json(await wayback(domain));
      default: return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Recon failed." }, { status: 200 });
  }
}
