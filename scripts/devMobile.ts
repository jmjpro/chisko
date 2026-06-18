import { networkInterfaces, type NetworkInterfaceInfo } from "os";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export function detectLanIp(
  ifaces: Record<
    string,
    NetworkInterfaceInfo[]
  > = networkInterfaces() as Record<string, NetworkInterfaceInfo[]>,
): string {
  for (const name of ["en0", "en1"]) {
    const addrs = ifaces[name] ?? [];
    const ipv4 = addrs.find((a) => a.family === "IPv4" && !a.internal);
    if (ipv4) return ipv4.address;
  }
  throw new Error(
    "No LAN IP found on en0 or en1. Are you connected to a network?",
  );
}

export function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1");
    env[key] = value;
  }
  return env;
}

// devMobile is only useful against a local self-hosted backend (127.0.0.1) —
// swapping the hostname of a cloud URL would produce a URL that looks valid
// but can never connect, so fail loudly instead.
export function withLanHost(url: string, lanIp: string): string {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error(
      `Expected a local Convex deployment (127.0.0.1) but VITE_CONVEX_URL is ${url}. ` +
        "Run `npx convex dev --once --configure existing --dev-deployment local` first.",
    );
  }
  parsed.hostname = lanIp;
  return parsed.toString().replace(/\/$/, "");
}

function main() {
  const ip = detectLanIp();
  const envPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.env.local",
  );
  const env = parseEnvFile(readFileSync(envPath, "utf-8"));
  const { VITE_CONVEX_URL, VITE_CONVEX_SITE_URL } = env;
  if (!VITE_CONVEX_URL || !VITE_CONVEX_SITE_URL) {
    throw new Error(
      "VITE_CONVEX_URL / VITE_CONVEX_SITE_URL not found in .env.local.",
    );
  }
  const convexUrl = withLanHost(VITE_CONVEX_URL, ip);
  const siteUrl = withLanHost(VITE_CONVEX_SITE_URL, ip);
  console.log(`Mobile dev server → ${convexUrl}`);
  spawn("npx", ["convex", "dev", "--start", "astro dev --host"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_CONVEX_URL: convexUrl,
      VITE_CONVEX_SITE_URL: siteUrl,
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
