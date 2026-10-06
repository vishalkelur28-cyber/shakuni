"use client";

import { useState } from "react";
import type { Hex } from "viem";
// viem is loaded on demand (see the run() handlers) so it stays out of the
// initial page bundle, the page shell loads fast, viem loads on first use.

type Tab = "chain" | "crypto";

export default function ChainLab() {
  const [tab, setTab] = useState<Tab>("chain");
  return (
    <div>
      <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
        {([["chain", "Chain Console"], ["crypto", "Attestation Lab"]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === v ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="callout callout-warn mt-5 text-xs leading-5">
        <b>Testnet only.</b> Use a testnet RPC, and only ever paste <b>test</b> private keys, never a key that holds real funds.
        The Chain Console is read-only (no transactions are sent).
      </div>
      <div className="mt-5">{tab === "chain" ? <ChainConsole /> : <CryptoLab />}</div>
    </div>
  );
}

function Out({ label, value, err }: { label?: string; value?: string; err?: string }) {
  if (!value && !err) return null;
  return (
    <div className="mt-3">
      {label && <p className="label mb-1">{label}</p>}
      {err ? <div className="callout callout-danger text-sm">{err}</div>
        : <pre className="overflow-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[12px] text-gray-200">{value}</pre>}
    </div>
  );
}

function ChainConsole() {
  const [rpc, setRpc] = useState("https://ethereum-sepolia-rpc.publicnode.com");
  const [op, setOp] = useState("block");
  const [addr, setAddr] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState("");
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setOut(""); setErr("");
    try {
      const { createPublicClient, http, isAddress, formatEther, isHex } = await import("viem");
      const client = createPublicClient({ transport: http(rpc) });
      if (op === "block") {
        const b = await client.getBlockNumber();
        setOut(`block number: ${b.toString()}`);
      } else if (op === "balance") {
        if (!isAddress(addr)) throw new Error("Enter a valid address.");
        const bal = await client.getBalance({ address: addr });
        setOut(`${formatEther(bal)} (native)  ·  ${bal.toString()} wei`);
      } else if (op === "code") {
        if (!isAddress(addr)) throw new Error("Enter a valid address.");
        const code = await client.getCode({ address: addr });
        setOut(code ? `${(code.length - 2) / 2} bytes of bytecode\n${code.slice(0, 2000)}${code.length > 2000 ? "…" : ""}` : "no code (EOA or not deployed)");
      } else if (op === "call") {
        if (!isAddress(to)) throw new Error("Enter a valid 'to' address.");
        if (!isHex(data)) throw new Error("Calldata must be 0x-hex.");
        const res = await client.call({ to, data: data as Hex });
        setOut(`returned: ${res.data ?? "0x"}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Call failed.");
    }
    setBusy(false);
  }

  return (
    <div className="card card-p">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="flex flex-col gap-1.5"><span className="label">Testnet RPC URL</span><input className="input font-mono text-[12px]" value={rpc} onChange={(e) => setRpc(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="label">Operation</span>
          <select className="input" value={op} onChange={(e) => setOp(e.target.value)}>
            <option value="block">Block number</option>
            <option value="balance">Native balance</option>
            <option value="code">Contract bytecode</option>
            <option value="call">eth_call (read)</option>
          </select>
        </label>
      </div>
      {(op === "balance" || op === "code") && (
        <label className="mt-3 flex flex-col gap-1.5"><span className="label">Address</span><input className="input font-mono text-[12px]" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" /></label>
      )}
      {op === "call" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5"><span className="label">To (contract)</span><input className="input font-mono text-[12px]" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" /></label>
          <label className="flex flex-col gap-1.5"><span className="label">Calldata</span><input className="input font-mono text-[12px]" value={data} onChange={(e) => setData(e.target.value)} placeholder="0x… (selector + args)" /></label>
        </div>
      )}
      <button type="button" className="btn btn-primary mt-3" onClick={run} disabled={busy}>{busy ? "Querying…" : "Query"}</button>
      <Out value={out} err={err} />
    </div>
  );
}

function CryptoLab() {
  const [op, setOp] = useState("keccak");
  const [input, setInput] = useState("");
  const [pk, setPk] = useState("");
  const [hash, setHash] = useState("");
  const [sig, setSig] = useState("");
  const [typed, setTyped] = useState('{\n  "domain": { "name": "App", "version": "1", "chainId": 1 },\n  "types": { "Mail": [ { "name": "value", "type": "uint256" } ] },\n  "primaryType": "Mail",\n  "message": { "value": 1 }\n}');
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");

  async function run() {
    setOut(""); setErr("");
    try {
      const { keccak256, toHex, isHex, recoverAddress, hashTypedData } = await import("viem");
      const { sign, privateKeyToAccount } = await import("viem/accounts");
      if (op === "keccak") {
        const h = isHex(input) ? keccak256(input as Hex) : keccak256(toHex(input));
        setOut(h);
      } else if (op === "address") {
        if (!isHex(pk)) throw new Error("Private key must be 0x-hex.");
        const acct = privateKeyToAccount(pk as Hex);
        setOut(`address: ${acct.address}`);
      } else if (op === "sign") {
        if (!isHex(pk)) throw new Error("Private key must be 0x-hex.");
        if (!isHex(hash)) throw new Error("Hash to sign must be 0x-hex (32 bytes).");
        const signature = await sign({ hash: hash as Hex, privateKey: pk as Hex, to: "hex" });
        const signer = privateKeyToAccount(pk as Hex).address;
        setOut(`signer:    ${signer}\nsignature: ${signature}`);
      } else if (op === "recover") {
        if (!isHex(hash) || !isHex(sig)) throw new Error("Hash and signature must be 0x-hex.");
        const addr = await recoverAddress({ hash: hash as Hex, signature: sig as Hex });
        setOut(`recovered signer: ${addr}`);
      } else if (op === "eip712") {
        const obj = JSON.parse(typed);
        const digest = hashTypedData(obj);
        setOut(`EIP-712 digest: ${digest}\n\nSign this digest in the 'Sign a 32-byte hash' op to produce an attestation.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Operation failed.");
    }
  }

  return (
    <div className="card card-p">
      <label className="flex flex-col gap-1.5"><span className="label">Operation</span>
        <select className="input max-w-sm" value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="keccak">keccak256 (text or 0x-hex)</option>
          <option value="address">Address from private key</option>
          <option value="sign">Sign a 32-byte hash (ECDSA)</option>
          <option value="recover">Recover signer from hash + signature</option>
          <option value="eip712">EIP-712 typed-data digest</option>
        </select>
      </label>

      {op === "keccak" && <label className="mt-3 flex flex-col gap-1.5"><span className="label">Input</span><input className="input font-mono text-[12px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder="hello  or  0xdeadbeef" /></label>}
      {(op === "address" || op === "sign") && <label className="mt-3 flex flex-col gap-1.5"><span className="label">Private key (TEST only)</span><input className="input font-mono text-[12px]" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="0x…" /></label>}
      {(op === "sign" || op === "recover") && <label className="mt-3 flex flex-col gap-1.5"><span className="label">Hash (32-byte, 0x-hex)</span><input className="input font-mono text-[12px]" value={hash} onChange={(e) => setHash(e.target.value)} placeholder="0x… (e.g. a keccak256 output)" /></label>}
      {op === "recover" && <label className="mt-3 flex flex-col gap-1.5"><span className="label">Signature (0x-hex)</span><input className="input font-mono text-[12px]" value={sig} onChange={(e) => setSig(e.target.value)} placeholder="0x…" /></label>}
      {op === "eip712" && <label className="mt-3 flex flex-col gap-1.5"><span className="label">Typed data (JSON: domain, types, primaryType, message)</span><textarea className="input min-h-[160px] font-mono text-[12px]" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} /></label>}

      <button type="button" className="btn btn-primary mt-3" onClick={run}>Run</button>
      <Out value={out} err={err} />
    </div>
  );
}
