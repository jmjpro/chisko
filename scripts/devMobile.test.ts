import { describe, expect, it } from "vitest";
import { detectLanIp, parseEnvFile, withLanHost } from "./devMobile";
import type { NetworkInterfaceInfo } from "os";

type Ifaces = Record<string, NetworkInterfaceInfo[]>;

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    family: "IPv4",
    internal,
    netmask: "",
    mac: "",
    cidr: null,
  };
}

describe("detectLanIp", () => {
  it("returns the en0 IPv4 address when available", () => {
    const ifaces: Ifaces = { en0: [ipv4("192.168.1.10")] };
    expect(detectLanIp(ifaces)).toBe("192.168.1.10");
  });

  it("falls back to en1 when en0 has no external IPv4", () => {
    const ifaces: Ifaces = {
      en0: [ipv4("127.0.0.1", true)],
      en1: [ipv4("192.168.1.20")],
    };
    expect(detectLanIp(ifaces)).toBe("192.168.1.20");
  });

  it("throws when neither en0 nor en1 have an external IPv4", () => {
    const ifaces: Ifaces = { en0: [ipv4("127.0.0.1", true)] };
    expect(() => detectLanIp(ifaces)).toThrow("No LAN IP found");
  });
});

describe("parseEnvFile", () => {
  it("parses simple KEY=value lines", () => {
    const env = parseEnvFile("VITE_CONVEX_URL=http://127.0.0.1:3212\nFOO=bar");
    expect(env).toEqual({
      VITE_CONVEX_URL: "http://127.0.0.1:3212",
      FOO: "bar",
    });
  });

  it("skips comments and blank lines", () => {
    const env = parseEnvFile("# a comment\n\nFOO=bar\n");
    expect(env).toEqual({ FOO: "bar" });
  });

  it("strips surrounding quotes from values", () => {
    const env = parseEnvFile('TOKEN="abc123"');
    expect(env).toEqual({ TOKEN: "abc123" });
  });

  it("keeps an inline comment-like trailing annotation as part of the line ignored via #", () => {
    const env = parseEnvFile(
      "CONVEX_DEPLOYMENT=local:foo # team: jmjpro, project: chisko",
    );
    expect(env.CONVEX_DEPLOYMENT).toBe(
      "local:foo # team: jmjpro, project: chisko",
    );
  });
});

describe("withLanHost", () => {
  it("swaps a loopback hostname for the LAN IP, preserving port and scheme", () => {
    expect(withLanHost("http://127.0.0.1:3212", "10.0.0.3")).toBe(
      "http://10.0.0.3:3212",
    );
  });

  it("accepts localhost as well as 127.0.0.1", () => {
    expect(withLanHost("http://localhost:3213", "10.0.0.3")).toBe(
      "http://10.0.0.3:3213",
    );
  });

  it("throws for a non-loopback (e.g. cloud) URL", () => {
    expect(() =>
      withLanHost(
        "https://prestigious-toucan-605.eu-west-1.convex.cloud",
        "10.0.0.3",
      ),
    ).toThrow("Expected a local Convex deployment");
  });
});
