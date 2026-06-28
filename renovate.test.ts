import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const config = JSON.parse(
  readFileSync(join(__dirname, "renovate.json"), "utf-8"),
);

const convexRule = config.packageRules?.find((r: Record<string, unknown>) => {
  const patterns: string[] = [
    ...(Array.isArray(r.matchPackageNames) ? r.matchPackageNames : []),
    ...(Array.isArray(r.matchPackagePatterns) ? r.matchPackagePatterns : []),
  ];
  return patterns.some(
    (p) => p === "convex" || p === "convex-test" || p.includes("@convex-dev"),
  );
});

describe("renovate.json — Convex packages", () => {
  it("has a rule matching convex, convex-test, and @convex-dev/*", () => {
    expect(convexRule).toBeDefined();
  });

  it("disables automerge for Convex packages", () => {
    expect(convexRule?.automerge).toBe(false);
  });
});

describe("renovate.json — schedule", () => {
  it("runs before 9am on sunday", () => {
    expect(config.schedule).toContain("before 9am on sunday");
  });
});

describe("renovate.json — devDependency auto-merge", () => {
  const devRule = config.packageRules?.find(
    (r: Record<string, unknown>) =>
      r.matchDepTypes &&
      (r.matchDepTypes as string[]).includes("devDependencies") &&
      r.automerge === true,
  );

  it("has an automerge rule for devDependencies patches and minors", () => {
    expect(devRule).toBeDefined();
  });

  it("groups devDependency updates into a single PR", () => {
    expect(typeof devRule?.groupName).toBe("string");
  });
});

describe("renovate.json — major bump policy", () => {
  const majorRule = config.packageRules?.find(
    (r: Record<string, unknown>) =>
      r.matchUpdateTypes &&
      (r.matchUpdateTypes as string[]).includes("major"),
  );

  it("has a rule for major updates", () => {
    expect(majorRule).toBeDefined();
  });

  it("disables automerge for major bumps", () => {
    expect(majorRule?.automerge).toBe(false);
  });
});
