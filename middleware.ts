import { NextResponse, type NextRequest } from "next/server";
import { localRequestProblem } from "./lib/security/local-only";

/** Shakuni is closed to everything except this machine. See lib/security/local-only.ts. */
export function middleware(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/");
  const problem = localRequestProblem(request.headers, { api });
  if (!problem) return NextResponse.next();
  const message = `Blocked: ${problem}. Shakuni only serves requests from this machine.`;
  return api
    ? NextResponse.json({ error: message }, { status: 403 })
    : new NextResponse(message, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr).*)"],
};
