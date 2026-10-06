/**
 * Where Arc Foundry (arc-forge / arc-anvil / arc-cast) runs. Server-only.
 *
 * Circle ships Arc Foundry for Linux and macOS only; on Windows it runs inside
 * WSL (https://docs.arc.io/arc/tutorials/install-arc-foundry). Shakuni's setup
 * imports a dedicated Ubuntu distro named "ShakuniArc" (WSL 1, which shares the
 * Windows network, so arc-anvil on 127.0.0.1:8545 is reachable from Windows)
 * with the binaries in /usr/local/bin. Override the distro with SHAKUNI_WSL_DISTRO.
 *
 * wsl.exe translates the Windows working directory (D:\…) to /mnt/d/…, so a
 * Windows projectDir works unchanged. Killing wsl.exe ends the Linux process.
 */

export const ARC_WSL_DISTRO = process.env.SHAKUNI_WSL_DISTRO || "ShakuniArc";

export function isArcTool(name: string): boolean {
  return /^arc-(forge|anvil|cast)$/.test(name);
}

/** The executable and leading args to spawn for a tool name. */
export function spawnTarget(name: string): { file: string; prefix: string[]; viaWsl: boolean } {
  if (process.platform === "win32" && isArcTool(name)) {
    return { file: "wsl.exe", prefix: ["-d", ARC_WSL_DISTRO, "--", name], viaWsl: true };
  }
  return { file: name, prefix: [], viaWsl: false };
}
