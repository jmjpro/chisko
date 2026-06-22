import { describe, expect, it } from "vitest";
import { backendPidPattern } from "./teardownWorktree";

describe("backendPidPattern", () => {
  it("points at this worktree's local backend data dir", () => {
    expect(backendPidPattern("/Users/jj/projects/chi-72")).toBe(
      "/Users/jj/projects/chi-72/.convex/local/default",
    );
  });
});
