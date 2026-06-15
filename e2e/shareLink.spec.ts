import { test, expect } from "@playwright/test";

test.describe("Share link route /r/[code]", () => {
  test("invalid share code returns 404", async ({ page }) => {
    const response = await page.goto("/r/INVALID");
    expect(response?.status()).toBe(404);
  });

  test("invalid share code shows Hebrew 404 page (default locale)", async ({
    page,
  }) => {
    await page.goto("/r/INVALID", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
  });

  // Note: testing OG meta tags for a valid share code requires a seeded
  // recommendation with a share code. Add that test once database seeding
  // is available in e2e setup.
});
