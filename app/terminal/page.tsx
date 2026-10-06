"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import PageHeader from "../../components/PageHeader";
import { Callout } from "../../components/ui";

interface SessionView {
  id: string;
  command: string;
  cwd: string;
  startedAt: string;
  running: boolean;
  exitCode: number | null;
}

type Block =
  | { kind: "run"; key: string; cwd: string; command: string; sessionId: string; output: string; offset: number; running: boolean; exitCode: number | null }
  | { kind: "note"; key: string; cwd: string; command: string; text: string; tone: "info" | "error" };

const HISTORY_KEY = "shakuni.terminal.history";
const POLL_MS = 400;

const QUICK: { label: string; command: string }[] = [
  { label: "Toolchain versions", command: "arc-forge --version" },
  { label: "Arc testnet head", command: "cast block-number --rpc-url https://rpc.testnet.arc.io" },
  { label: "Start Arc fork", command: "arc-anvil --fork-url https://rpc.testnet.arc.io --fork-block-number " },
  { label: "Build tests", command: "arc-forge build" },
  { label: "Run parity invariant", command: "arc-forge test --match-contract MintConservationInvariant --fork-url http://127.0.0.1:8545 -vvv" },
  { label: "Typecheck Shakuni", command: "npm run typecheck" },
];

const HELP = `Built-ins: help · clear · pwd · cd <dir> · ps · kill <id|all>
Allowed programs: {allowed}
One command at a time, no pipes, redirects, ; or &&. No interactive input.
Long-running processes (arc-anvil) keep running in the background; use ps / kill.
Ctrl+C kills the most recent running process. ↑/↓ browse history.`;

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export default function TerminalPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [cwd, setCwd] = useState(".");
  const [input, setInput] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const note = useCallback((command: string, text: string, tone: "info" | "error" = "info") => {
    setBlocks((b) => [...b, { kind: "note", key: `n${Date.now()}${Math.random()}`, cwd, command, text, tone }]);
  }, [cwd]);

  // Load allowlist, history, and re-attach to processes still running from an earlier visit.
  useEffect(() => {
    try { setHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]")); } catch { /* storage blocked */ }
    api<{ sessions: SessionView[]; allowed: string[] }>("/api/terminal")
      .then(({ sessions, allowed }) => {
        setAllowed(allowed);
        const running = sessions.filter((s) => s.running).reverse();
        if (running.length) {
          setBlocks(running.map((s) => ({ kind: "run", key: s.id, cwd: s.cwd, command: s.command, sessionId: s.id, output: "", offset: 0, running: true, exitCode: null })));
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Terminal unavailable."));
  }, []);

  // Poll running sessions for output.
  const anyRunning = blocks.some((b) => b.kind === "run" && b.running);
  useEffect(() => {
    if (!anyRunning) return;
    let stopped = false;
    const tick = async () => {
      const live = blocksRef.current.filter((b): b is Extract<Block, { kind: "run" }> => b.kind === "run" && b.running);
      const updates = await Promise.all(live.map((b) =>
        api<SessionView & { chunk: string; offset: number }>(`/api/terminal?id=${encodeURIComponent(b.sessionId)}&offset=${b.offset}`)
          .then((r) => ({ key: b.key, r }))
          .catch(() => ({ key: b.key, r: null }))));
      if (stopped) return;
      setBlocks((bs) => bs.map((b) => {
        if (b.kind !== "run") return b;
        const u = updates.find((x) => x.key === b.key);
        if (!u) return b;
        if (!u.r) return { ...b, running: false, output: b.output + "\n[session lost, the server may have restarted]\n" };
        return { ...b, output: b.output + u.r.chunk, offset: u.r.offset, running: u.r.running, exitCode: u.r.exitCode };
      }));
    };
    const t = window.setInterval(tick, POLL_MS);
    tick();
    return () => { stopped = true; window.clearInterval(t); };
  }, [anyRunning]);

  // Stick to the bottom as output arrives.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks]);

  const pushHistory = (cmd: string) => {
    setHistory((h) => {
      const next = [...h.filter((x) => x !== cmd), cmd].slice(-100);
      try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setHistIdx(null);
  };

  const kill = async (id: string) => {
    try { await api(`/api/terminal?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch (e) { note(`kill ${id}`, e instanceof Error ? e.message : "kill failed", "error"); }
  };

  const run = async (raw: string) => {
    const line = raw.trim();
    setInput("");
    if (!line) return;
    pushHistory(line);
    const [head, ...rest] = line.split(/\s+/);

    if (head === "clear") { setBlocks((b) => b.filter((x) => x.kind === "run" && x.running)); return; }
    if (head === "help") { note(line, HELP.replace("{allowed}", allowed.join(", "))); return; }
    if (head === "pwd") { note(line, cwd === "." ? "./ (Shakuni project root)" : `./${cwd.replace(/\\/g, "/")}`); return; }
    if (head === "cd") {
      try {
        const r = await api<{ cwd: string }>("/api/terminal", { method: "POST", body: JSON.stringify({ action: "cd", cwd, target: rest.join(" ") || "." }) });
        setCwd(r.cwd);
        setBlocks((b) => [...b, { kind: "note", key: `n${Date.now()}`, cwd, command: line, text: "", tone: "info" }]);
      } catch (e) { note(line, e instanceof Error ? e.message : "cd failed", "error"); }
      return;
    }
    if (head === "ps") {
      try {
        const { sessions } = await api<{ sessions: SessionView[] }>("/api/terminal");
        note(line, sessions.length
          ? sessions.map((s) => `${s.id.padEnd(14)} ${(s.running ? "running" : `exit ${s.exitCode ?? "?"}`).padEnd(9)} ${s.command}`).join("\n")
          : "No processes.");
      } catch (e) { note(line, e instanceof Error ? e.message : "ps failed", "error"); }
      return;
    }
    if (head === "kill") {
      const target = rest[0];
      if (!target) { note(line, "Usage: kill <id|all>", "error"); return; }
      const ids = target === "all"
        ? blocksRef.current.filter((b) => b.kind === "run" && b.running).map((b) => (b as Extract<Block, { kind: "run" }>).sessionId)
        : [target];
      await Promise.all(ids.map(kill));
      note(line, ids.length ? `Killed ${ids.join(", ")}` : "Nothing running.");
      return;
    }

    setBusy(true);
    try {
      const s = await api<SessionView>("/api/terminal", { method: "POST", body: JSON.stringify({ command: line, cwd }) });
      setBlocks((b) => [...b, { kind: "run", key: s.id, cwd, command: line, sessionId: s.id, output: "", offset: 0, running: true, exitCode: null }]);
    } catch (e) {
      note(line, e instanceof Error ? e.message : "Command failed to start.", "error");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); run(input); return; }
    if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      const last = [...blocksRef.current].reverse().find((b) => b.kind === "run" && b.running) as Extract<Block, { kind: "run" }> | undefined;
      if (last) { e.preventDefault(); kill(last.sessionId); }
      return;
    }
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const i = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i); setInput(history[i]);
    }
    if (e.key === "ArrowDown" && histIdx !== null) {
      e.preventDefault();
      const i = histIdx + 1;
      if (i >= history.length) { setHistIdx(null); setInput(""); } else { setHistIdx(i); setInput(history[i]); }
    }
  };

  const running = blocks.filter((b): b is Extract<Block, { kind: "run" }> => b.kind === "run" && b.running);
  const prompt = (dir: string) => `shakuni:${dir === "." ? "~" : `~/${dir.replace(/\\/g, "/")}`}$`;

  return <div>
    <PageHeader
      eyebrow="Tools"
      title="Shakuni terminal"
      description="Run Foundry, Arc fork tools, git and npm from inside Shakuni. Commands run on this machine, in the project folder, without a shell."
      aside={<span className="badge badge-green self-start md:self-auto">Localhost only · allowlisted</span>}
    />

    {loadError && <div className="mt-6"><Callout tone="danger" role="alert">{loadError}</Callout></div>}

    <div className="mt-6 flex flex-wrap gap-2">
      {QUICK.map((q) => (
        <button key={q.label} type="button" onClick={() => { setInput(q.command); inputRef.current?.focus(); }} className="btn btn-sm btn-ghost">{q.label}</button>
      ))}
    </div>

    <div className="card mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] px-4 py-2.5">
        <span className="font-mono text-xs text-gray-400">{prompt(cwd)}</span>
        <span className="text-[11px] text-gray-500">{running.length ? `${running.length} running` : "idle"}</span>
      </div>
      <div
        ref={scroller}
        onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus(); }}
        className="h-[28rem] overflow-auto bg-black/40 px-4 py-3 font-mono text-xs leading-5 sm:h-[34rem]"
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {blocks.length === 0 && <p className="text-gray-500">Type <span className="text-gray-300">help</span> to see what you can run.</p>}
        {blocks.map((b) => (
          <div key={b.key} className="mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-accent">{prompt(b.cwd)}</span>
              <span className="break-all text-gray-100">{b.command}</span>
              {b.kind === "run" && (b.running
                ? <><span className="badge badge-blue">running</span><button type="button" onClick={() => kill(b.sessionId)} className="text-[11px] text-red-300 underline">kill</button></>
                : <span className={`badge ${b.exitCode === 0 ? "badge-green" : "badge-red"}`}>exit {b.exitCode ?? "?"}</span>)}
            </div>
            {b.kind === "run" && b.output && <pre className="mt-1 whitespace-pre-wrap break-words text-gray-300">{b.output}</pre>}
            {b.kind === "note" && b.text && <pre className={`mt-1 whitespace-pre-wrap break-words ${b.tone === "error" ? "text-red-300" : "text-gray-400"}`}>{b.text}</pre>}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <label htmlFor="terminal-input" className="shrink-0 text-accent">{prompt(cwd)}</label>
          <input
            id="terminal-input"
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setHistIdx(null); }}
            onKeyDown={onKeyDown}
            disabled={busy}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-gray-100 outline-none placeholder:text-gray-600"
            placeholder={busy ? "starting…" : "arc-forge test …"}
          />
        </div>
      </div>
    </div>

    <div className="mt-4">
      <Callout tone="warn">
        The allowlist stops mistakes, not a determined user: <span className="font-mono">node</span>, <span className="font-mono">npm</span> and <span className="font-mono">git</span> can still run arbitrary code. What keeps it closed is that Shakuni only answers requests from this machine, never start it with <span className="font-mono">-H 0.0.0.0</span> or expose the port.
      </Callout>
    </div>
  </div>;
}
