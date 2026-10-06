import { NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";
import { localRequestProblem } from "../../../lib/security/local-only";

/**
 * /api/http-send, raw HTTP request sender for the Request Workbench (a focused
 * Burp-style repeater / IDOR runner). Sends one request server-side (so there is
 * no browser CORS) and returns the raw status, headers and body WITHOUT following
 * redirects, so open-redirect and OAuth flows stay visible.
 *
 * Local only: it makes network requests from your machine, so it is gated the
 * same way as the Terminal. For authorized testing on sandbox/testnet only.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_CAP = 256 * 1024; // 256 KB response cap
const TIMEOUT = 20_000;
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

interface SendResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  size: number;
  truncated: boolean;
}

function send(method: string, target: string, headers: Record<string, string>, body?: string): Promise<SendResult> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(target); } catch { reject(new Error("Invalid URL.")); return; }
    if (u.protocol !== "http:" && u.protocol !== "https:") { reject(new Error("URL must be http(s).")); return; }
    const lib = u.protocol === "https:" ? https : http;
    const start = Date.now();
    const req = lib.request(u, { method, headers, timeout: TIMEOUT }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => { size += c.length; if (size <= BODY_CAP) chunks.push(c); });
      res.on("end", () => {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) flat[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
        resolve({
          status: res.statusCode ?? 0,
          headers: flat,
          body: Buffer.concat(chunks).toString("utf8"),
          timeMs: Date.now() - start,
          size,
          truncated: size > BODY_CAP,
        });
      });
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", reject);
    if (body && method !== "GET" && method !== "HEAD") req.write(body);
    req.end();
  });
}

export async function POST(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  if (problem) return NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 });

  let b: { method?: unknown; url?: unknown; headers?: unknown; body?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 }); }

  const method = (typeof b.method === "string" ? b.method : "GET").toUpperCase();
  if (!METHODS.has(method)) return NextResponse.json({ error: `Unsupported method: ${method}` }, { status: 400 });
  if (typeof b.url !== "string" || !b.url.trim()) return NextResponse.json({ error: "url is required." }, { status: 400 });

  const headers: Record<string, string> = {};
  if (b.headers && typeof b.headers === "object") {
    for (const [k, v] of Object.entries(b.headers as Record<string, unknown>)) {
      if (k && typeof v === "string") headers[k] = v;
    }
  }
  const body = typeof b.body === "string" && b.body.length ? b.body : undefined;

  try {
    const r = await send(method, b.url.trim(), headers, body);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 200 });
  }
}
