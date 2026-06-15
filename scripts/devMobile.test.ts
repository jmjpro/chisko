import { describe, expect, it } from "vitest";
import { detectLanIp } from "./devMobile";
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
