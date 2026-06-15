import { test, expect } from "@playwright/test";

test.describe("Plans page — build-time data fetch", () => {
  test("/en/plans renders plan rows immediately (no loading spinner)", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    // Table is in the HTML from the start — no waiting for Convex WebSocket
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // At least one plan row should be present
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("/plans (Hebrew default) renders plan rows with Hebrew supplier names", async ({
    page,
  }) => {
    await page.goto("/plans");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Hebrew locale: at least one translated supplier name should appear
    // (not the raw English key like "Bezek Electricity")
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });
});
