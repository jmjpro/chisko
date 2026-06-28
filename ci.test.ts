import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const yaml = readFileSync(
  join(__dirname, ".github", "workflows", "ci.yml"),
  "utf-8",
);

describe("ci.yml — triggers", () => {
  it("triggers on pull_request", () => {
    expect(yaml).toMatch(/^\s*pull_request\s*:/m);
  });

  it("triggers on push to main", () => {
    expect(yaml).toContain("main");
  });
});

describe("ci.yml — required steps", () => {
  it("runs typecheck", () => {
    expect(yaml).toMatch(/npm run typecheck/);
  });

  it("runs lint", () => {
    expect(yaml).toMatch(/npm run lint/);
  });

  it("runs tests", () => {
    expect(yaml).toMatch(/npm (run )?test/);
  });

  it("runs npm audit with high audit level", () => {
    expect(yaml).toMatch(/npm audit.*--audit-level[= ]high/);
  });
});

describe("ci.yml — excluded steps", () => {
  it("does not run npm run build", () => {
    expect(yaml).not.toMatch(/npm run build/);
  });
});
