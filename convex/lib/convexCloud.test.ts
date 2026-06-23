import { afterEach, expect, test, vi } from "vitest";
import { isConvexCloudEnabled } from "./convexCloud";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("is enabled when ENABLE_CONVEX_CLOUD is unset", () => {
  expect(isConvexCloudEnabled()).toBe(true);
});

test("is disabled only when ENABLE_CONVEX_CLOUD is the literal string 'false'", () => {
  vi.stubEnv("ENABLE_CONVEX_CLOUD", "false");
  expect(isConvexCloudEnabled()).toBe(false);
});

test.each(["true", ""])(
  "is enabled when ENABLE_CONVEX_CLOUD is %j",
  (value) => {
    vi.stubEnv("ENABLE_CONVEX_CLOUD", value);
    expect(isConvexCloudEnabled()).toBe(true);
  },
);
