import { NextResponse } from "next/server";
import { localRequestProblem } from "../../../lib/security/local-only";
import { ALLOWED_COMMANDS, PROJECT_ROOT, TerminalError, killSession, listSessions, readSession, resolveCwd, startCommand } from "../../../lib/terminal/runner";

/**
 * /api/terminal, Shakuni's allowlisted command runner.
 *
 *   GET                      list sessions + allowed commands
 *   GET  ?id=…&offset=N      poll a session's output from offset N
 *   POST {command, cwd}      start a command
 *   POST {action:"cd", cwd, target}  resolve a directory inside the project
 *   DELETE ?id=…             kill a session
 *
 * Local only: the middleware already refuses non-local requests; this route
 * checks again because it runs processes on your machine.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(request: Request) {
  const problem = localRequestProblem(request.headers, { api: true });
  return problem ? NextResponse.json({ error: `Blocked: ${problem}.` }, { status: 403 }) : null;
}

function fail(error: unknown) {
  if (error instanceof TerminalError) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Terminal error." }, { status: 500 });
}

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) return NextResponse.json(readSession(id, Number(url.searchParams.get("offset")) || 0));
    return NextResponse.json({ sessions: listSessions(), allowed: ALLOWED_COMMANDS, root: PROJECT_ROOT });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: { action?: unknown; command?: unknown; cwd?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const cwd = typeof body.cwd === "string" ? body.cwd : ".";
  try {
    if (body.action === "cd") {
      return NextResponse.json({ cwd: resolveCwd(cwd, typeof body.target === "string" ? body.target : ".") });
    }
    if (typeof body.command !== "string") return NextResponse.json({ error: "command is required." }, { status: 400 });
    return NextResponse.json(startCommand(body.command, cwd));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    return NextResponse.json(killSession(id));
  } catch (e) {
    return fail(e);
  }
}
