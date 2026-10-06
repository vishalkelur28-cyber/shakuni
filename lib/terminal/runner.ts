import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnTarget } from "../runtime/arc-tools";

/**
 * Shakuni's built-in terminal. Server-only.
 *
 * - Only allowlisted research tools can run. Commands are spawned directly,
 *   never through a shell, so ";", "&&", pipes and redirects can't chain in
 *   anything else.
 * - The working directory is confined to the Shakuni project folder.
 * - Processes keep running in the background (e.g. anvil) until they exit or
 *   are killed; output is buffered so the page can poll and re-attach.
 * - The API route is reachable only from this machine (middleware + route guard).
 */

export const PROJECT_ROOT = process.cwd();

export const ALLOWED_COMMANDS = ["arc-forge", "arc-anvil", "arc-cast", "forge", "anvil", "cast", "git", "npm", "node"] as const;

const CHAIN_TOKENS = new Set(["|", "||", "&", "&&", ";", ">", ">>", "<", "2>", "2>&1"]);
const MAX_RUNNING = 4;
const MAX_KEPT = 20;
const MAX_BUFFER = 512 * 1024;
const MAX_COMMAND_LENGTH = 4000;

export interface TerminalSession {
  id: string;
  command: string;
  cwd: string; // relative to PROJECT_ROOT, "." for the root
  startedAt: string;
  finishedAt?: string;
  running: boolean;
  exitCode: number | null;
  /** Characters dropped from the front of the buffer once it passed MAX_BUFFER. */
  dropped: number;
  output: string;
  child?: ChildProcess;
}

export interface SessionView {
  id: string;
  command: string;
  cwd: string;
  startedAt: string;
  finishedAt?: string;
  running: boolean;
  exitCode: number | null;
}

// Survive Next dev hot reloads so running processes aren't orphaned from the registry.
const g = globalThis as typeof globalThis & { __shakuniTerminal?: Map<string, TerminalSession>; __shakuniTerminalExitHook?: boolean };
const sessions: Map<string, TerminalSession> = g.__shakuniTerminal ?? (g.__shakuniTerminal = new Map());
if (!g.__shakuniTerminalExitHook) {
  g.__shakuniTerminalExitHook = true;
  process.on("exit", () => { for (const s of sessions.values()) if (s.running) s.child?.kill(); });
}

export class TerminalError extends Error {}

/** Split a command line into argv. Supports "double" and 'single' quotes; backslashes stay literal (Windows paths). */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += ch;
    }
  }
  if (quote) throw new TerminalError("Unclosed quote.");
  if (has || cur) out.push(cur);
  return out;
}

/** Resolve a user-supplied directory inside the project. Throws if it escapes the project or doesn't exist. */
export function resolveCwd(base: string, target: string): string {
  const abs = path.resolve(PROJECT_ROOT, base || ".", target || ".");
  const rel = path.relative(PROJECT_ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new TerminalError("The terminal is confined to the Shakuni project folder.");
  if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new TerminalError(`No such directory: ${target}`);
  return rel || ".";
}

function resolveBinary(name: string): { file: string; prefix: string[] } {
  if (name === "node") return { file: process.execPath, prefix: [] };
  if (name === "npm" && process.platform === "win32") {
    // npm is a .cmd on Windows, which Node won't spawn without a shell. Run its JS entry directly.
    const cli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!existsSync(cli)) throw new TerminalError("npm not found next to node.exe.");
    return { file: process.execPath, prefix: [cli] };
  }
  const target = spawnTarget(name); // arc-* tools run inside WSL on Windows
  return { file: target.file, prefix: target.prefix };
}

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

function append(s: TerminalSession, text: string) {
  s.output += text.replace(ANSI, "");
  if (s.output.length > MAX_BUFFER) {
    const cut = s.output.length - MAX_BUFFER;
    s.output = s.output.slice(cut);
    s.dropped += cut;
  }
}

function view(s: TerminalSession): SessionView {
  return { id: s.id, command: s.command, cwd: s.cwd, startedAt: s.startedAt, finishedAt: s.finishedAt, running: s.running, exitCode: s.exitCode };
}

function prune() {
  const done = [...sessions.values()].filter((s) => !s.running).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  while (sessions.size > MAX_KEPT && done.length) sessions.delete(done.shift()!.id);
}

export function startCommand(commandLine: string, cwdInput: string): SessionView {
  const line = commandLine.trim();
  if (!line) throw new TerminalError("Empty command.");
  if (line.length > MAX_COMMAND_LENGTH) throw new TerminalError("Command is too long.");

  const argv = tokenize(line);
  const [name, ...args] = argv;
  if (!(ALLOWED_COMMANDS as readonly string[]).includes(name)) {
    throw new TerminalError(`"${name}" is not an allowed command. Allowed: ${ALLOWED_COMMANDS.join(", ")}.`);
  }
  if (args.some((a) => CHAIN_TOKENS.has(a))) {
    throw new TerminalError("Pipes, redirects and command chaining aren't supported. Run one command at a time.");
  }
  if ([...sessions.values()].filter((s) => s.running).length >= MAX_RUNNING) {
    throw new TerminalError(`Already ${MAX_RUNNING} processes running. Kill one first.`);
  }

  const cwd = resolveCwd(".", cwdInput);
  const { file, prefix } = resolveBinary(name);
  const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const session: TerminalSession = { id, command: line, cwd, startedAt: new Date().toISOString(), running: true, exitCode: null, dropped: 0, output: "" };
  sessions.set(id, session);
  prune();

  const child = spawn(file, [...prefix, ...args], {
    cwd: path.resolve(PROJECT_ROOT, cwd),
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", CLICOLOR: "0" },
    shell: false,
    windowsHide: true,
  });
  session.child = child;
  child.stdin?.end(); // no interactive input
  child.stdout?.on("data", (d: Buffer) => append(session, d.toString()));
  child.stderr?.on("data", (d: Buffer) => append(session, d.toString()));
  child.on("error", (e: NodeJS.ErrnoException) => {
    append(session, e.code === "ENOENT" ? `${name}: command not found. Is it installed and on PATH?\n` : `${name}: ${e.message}\n`);
    finish(session, null);
  });
  child.on("close", (code) => finish(session, code));
  return view(session);
}

function finish(s: TerminalSession, code: number | null) {
  if (!s.running) return;
  s.running = false;
  s.exitCode = code;
  s.finishedAt = new Date().toISOString();
  s.child = undefined;
}

export function readSession(id: string, offset: number): SessionView & { chunk: string; offset: number } {
  const s = sessions.get(id);
  if (!s) throw new TerminalError(`No session ${id}.`);
  const start = Math.max(0, offset - s.dropped);
  const chunk = (offset < s.dropped ? `[… ${s.dropped - offset} earlier characters dropped …]\n` : "") + s.output.slice(start);
  return { ...view(s), chunk, offset: s.dropped + s.output.length };
}

export function listSessions(): SessionView[] {
  return [...sessions.values()].map(view).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function killSession(id: string): SessionView {
  const s = sessions.get(id);
  if (!s) throw new TerminalError(`No session ${id}.`);
  if (s.running && s.child?.pid) {
    if (process.platform === "win32") {
      // Kill the whole tree (npm, forge, etc. spawn children).
      spawn("taskkill", ["/pid", String(s.child.pid), "/T", "/F"], { windowsHide: true, shell: false });
    } else {
      s.child.kill("SIGTERM");
    }
    append(s, "\n^C killed\n");
  }
  return view(s);
}
