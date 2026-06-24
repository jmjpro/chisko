import { describe, expect, it } from "vitest";
import { seedAndBuildCmd } from "./vercelBuild";

describe("seedAndBuildCmd", () => {
  it("keeps SEED_SECRET and VITE_CONVEX_URL as unexpanded shell references", () => {
    expect(seedAndBuildCmd()).toBe(
      'curl -fsS -X POST "${VITE_CONVEX_URL/.convex.cloud/.convex.site}/seed" -H "Authorization: Bearer $SEED_SECRET" && npm run build',
    );
  });
});
