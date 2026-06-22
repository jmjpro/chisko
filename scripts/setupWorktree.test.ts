import { describe, expect, it } from "vitest";
import {
  convexPortsFor,
  findEnvLocalSource,
  parseWorktreePaths,
  withPort,
} from "./setupWorktree";
import { existsSync } from "fs";
import { vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn() };
});

describe("parseWorktreePaths", () => {
  it("extracts worktree paths from porcelain output", () => {
    const porcelain = [
      "worktree /Users/jj/projects/ec2",
      "HEAD cd04f2a",
      "branch refs/heads/main",
      "",
      "worktree /Users/jj/projects/chi-38-fix-locale",
      "HEAD cd04f2a",
      "branch refs/heads/chi-38-fix-locale",
      "",
    ].join("\n");

    expect(parseWorktreePaths(porcelain)).toEqual([
      "/Users/jj/projects/ec2",
      "/Users/jj/projects/chi-38-fix-locale",
    ]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseWorktreePaths("")).toEqual([]);
  });
});

describe("findEnvLocalSource", () => {
  it("returns the first other worktree's .env.local that exists", () => {
    vi.mocked(existsSync).mockImplementation(
      (p) => p === "/Users/jj/projects/ec2/.env.local",
    );

    const source = findEnvLocalSource(
      ["/Users/jj/projects/ec2", "/Users/jj/projects/chi-38-fix-locale"],
      "/Users/jj/projects/chi-38-fix-locale",
    );

    expect(source).toBe("/Users/jj/projects/ec2/.env.local");
  });

  it("skips the current worktree even if it has a .env.local", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const source = findEnvLocalSource(
      ["/Users/jj/projects/chi-38-fix-locale", "/Users/jj/projects/ec2"],
      "/Users/jj/projects/chi-38-fix-locale",
    );

    expect(source).toBe("/Users/jj/projects/ec2/.env.local");
  });

  it("throws when no other worktree has a .env.local", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() =>
      findEnvLocalSource(
        ["/Users/jj/projects/ec2"],
        "/Users/jj/projects/chi-38-fix-locale",
      ),
    ).toThrow("No .env.local found in any other worktree");
  });
});

describe("withPort", () => {
  it("appends PORT when the file has none", () => {
    const result = withPort("VITE_CONVEX_URL=http://127.0.0.1:3212\n", "5180");
    expect(result).toBe("VITE_CONVEX_URL=http://127.0.0.1:3212\nPORT=5180\n");
  });

  it("replaces an existing PORT line", () => {
    const result = withPort("FOO=bar\nPORT=5173\nBAZ=qux", "5180");
    expect(result).toBe("FOO=bar\nPORT=5180\nBAZ=qux");
  });
});

describe("convexPortsFor", () => {
  it("derives non-colliding cloud/site ports from the frontend port", () => {
    expect(convexPortsFor("4322")).toEqual({ cloud: 14322, site: 14323 });
  });
});
