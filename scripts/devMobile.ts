import { networkInterfaces, type NetworkInterfaceInfo } from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

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

function main() {
  const ip = detectLanIp();
  const convexUrl = `http://${ip}:3210`;
  const siteUrl = `http://${ip}:3211`;
  console.log(`Mobile dev server → ${convexUrl}`);
  spawn("npx", ["convex", "dev", "--start", "vite --open"], {
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
