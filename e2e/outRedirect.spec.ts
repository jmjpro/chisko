import { test, expect } from "@playwright/test";

test.describe("Click-through redirect route /out/:supplierId/:planVersionId", () => {
  test("invalid supplier/plan version combo returns 404", async ({ page }) => {
    const response = await page.goto(
      "/out/invalidSupplierId/invalidPlanVersionId?sessionId=invalidSessionId",
    );
    expect(response?.status()).toBe(404);
  });

  test("missing sessionId returns 404", async ({ page }) => {
    const response = await page.goto(
      "/out/invalidSupplierId/invalidPlanVersionId",
    );
    expect(response?.status()).toBe(404);
  });

  test("invalid combo shows Hebrew 404 page (default locale)", async ({
    page,
  }) => {
    await page.goto(
      "/out/invalidSupplierId/invalidPlanVersionId?sessionId=invalidSessionId",
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
  });
});
