"use client";

import { useEffect, useState } from "react";

type Op =
  | "b64enc" | "b64dec" | "urlenc" | "urldec" | "htmlenc" | "htmldec"
  | "hexenc" | "hexdec" | "uniesc" | "unidec" | "rot13" | "jwt"
  | "sha1" | "sha256" | "sha512";

const OPS: { id: Op; label: string }[] = [
  { id: "b64enc", label: "Base64 encode" }, { id: "b64dec", label: "Base64 decode" },
  { id: "urlenc", label: "URL encode" }, { id: "urldec", label: "URL decode" },
  { id: "htmlenc", label: "HTML encode" }, { id: "htmldec", label: "HTML decode" },
  { id: "hexenc", label: "Hex encode" }, { id: "hexdec", label: "Hex decode" },
  { id: "uniesc", label: "Unicode escape" }, { id: "unidec", label: "Unicode unescape" },
  { id: "rot13", label: "ROT13" }, { id: "jwt", label: "JWT decode" },
  { id: "sha1", label: "SHA-1" }, { id: "sha256", label: "SHA-256" }, { id: "sha512", label: "SHA-512" },
];

function b64encode(s: string) { return btoa(unescape(encodeURIComponent(s))); }
function b64decode(s: string) { return decodeURIComponent(escape(atob(s.replace(/\s/g, "")))); }
function b64url(s: string) { let t = s.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; return decodeURIComponent(escape(atob(t))); }
function htmlEncode(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function htmlDecode(s: string) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'"); }
function hexEncode(s: string) { return Array.from(new TextEncoder().encode(s)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function hexDecode(s: string) { const h = s.replace(/[^0-9a-fA-F]/g, ""); const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return new TextDecoder().decode(a); }
function rot13(s: string) { return s.replace(/[a-zA-Z]/g, (c) => { const base = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base); }); }
function uniEsc(s: string) { return Array.from(s).map((c) => { const n = c.codePointAt(0)!; return n > 127 || n < 32 ? "\\u" + n.toString(16).padStart(4, "0") : c; }).join(""); }
function uniDec(s: string) { return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); }
function jwtDecode(s: string) {
  const p = s.trim().split("."); if (p.length < 2) throw new Error("Not a JWT (need header.payload.signature).");
  const head = JSON.parse(b64url(p[0])); const body = JSON.parse(b64url(p[1]));
  return `// header\n${JSON.stringify(head, null, 2)}\n\n// payload\n${JSON.stringify(body, null, 2)}\n\n// signature\n${p[2] ?? "(none)"}`;
}
async function sha(algo: string, s: string) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Decoder() {
  const [op, setOp] = useState<Op>("b64enc");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      setErr("");
      if (!input) { setOutput(""); return; }
      try {
        let out = "";
        switch (op) {
          case "b64enc": out = b64encode(input); break;
          case "b64dec": out = b64decode(input); break;
          case "urlenc": out = encodeURIComponent(input); break;
          case "urldec": out = decodeURIComponent(input); break;
          case "htmlenc": out = htmlEncode(input); break;
          case "htmldec": out = htmlDecode(input); break;
          case "hexenc": out = hexEncode(input); break;
          case "hexdec": out = hexDecode(input); break;
          case "uniesc": out = uniEsc(input); break;
          case "unidec": out = uniDec(input); break;
          case "rot13": out = rot13(input); break;
          case "jwt": out = jwtDecode(input); break;
          case "sha1": out = await sha("SHA-1", input); break;
          case "sha256": out = await sha("SHA-256", input); break;
          case "sha512": out = await sha("SHA-512", input); break;
        }
        if (live) setOutput(out);
      } catch (e) { if (live) { setErr(e instanceof Error ? e.message : "Transform failed."); setOutput(""); } }
    })();
    return () => { live = false; };
  }, [op, input]);

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  }

  return (
    <div>
      <p className="muted mb-5 max-w-2xl">Encode, decode and hash, like Burp&apos;s Decoder. Runs entirely in your browser.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1.5"><span className="label">Operation</span>
          <select className="input max-w-xs" value={op} onChange={(e) => setOp(e.target.value as Op)}>
            {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-ghost btn-sm self-end" onClick={() => { const i = input; setInput(output); setOutput(i); }} title="Use output as input">Output to input</button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="label">Input</span>
          <textarea className="input min-h-[220px] font-mono text-[12.5px]" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste text here" />
        </label>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between"><span className="label">Output</span><button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={!output}>{copied ? "Copied" : "Copy"}</button></div>
          {err ? <div className="callout callout-danger text-sm">{err}</div>
            : <pre className="min-h-[220px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12.5px] text-gray-200">{output || " "}</pre>}
        </div>
      </div>
    </div>
  );
}
