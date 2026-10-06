/**
 * Localhost-only guard. Shakuni runs on the researcher's own machine and must
 * not be reachable from anything else. Edge-safe (no Node imports) so the
 * middleware can use it.
 *
 * - Host must be a loopback name: blocks LAN access even if the server was
 *   started without `-H 127.0.0.1`, and blocks DNS-rebinding pages.
 * - For API calls, a browser request must come from this same local origin:
 *   blocks other websites open in your browser from calling the terminal,
 *   fork-test or GitHub routes.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export function isLocalHost(host: string | null): boolean {
  return Boolean(host) && LOCAL_HOSTNAMES.has(hostnameOf(host as string));
}

/** Null when the request is from this machine's own Shakuni origin, else the reason it is refused. */
export function localRequestProblem(headers: Headers, { api }: { api: boolean }): string | null {
  const host = headers.get("host");
  if (!isLocalHost(host)) return `host "${host ?? ""}" is not localhost`;
  if (!api) return null;

  const origin = headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return "malformed Origin header";
    }
    if (originHost !== (host as string).toLowerCase()) return `cross-origin request from ${origin}`;
  }
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return `cross-site request (${site})`;
  return null;
}
