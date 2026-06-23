import { execFileSync } from "child_process";
import { describe, expect, it } from "vitest";
import { getChangedFiles } from "./lintBranch";

describe("getChangedFiles", () => {
  it("returns no files when the base ref is the current HEAD", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    expect(getChangedFiles(head)).toEqual([]);
  });
});
