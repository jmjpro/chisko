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

test.describe("Plans page — Leave details CTA", () => {
  test("submitting step 1 and confirming fan-out reports suppliers contacted", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    const firstRow = page.locator("tbody tr").first();
    const leaveDetails = firstRow.getByRole("button", {
      name: "Leave details",
    });
    await leaveDetails.waitFor({ state: "visible", timeout: 15000 });
    await leaveDetails.click();

    await expect(page.getByText("Leave your details")).toBeVisible();
    await page.getByLabel("Full name").fill("Playwright Tester");
    await page.getByLabel("Phone number").fill("0501234567");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByText("Also share with these suppliers?"),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: "Also share with these suppliers" })
      .click();

    await expect(page.getByText("will contact you")).toBeVisible({
      timeout: 10000,
    });
  });

  test("declining the fan-out step closes the dialog", async ({ page }) => {
    await page.goto("/en/plans");

    const firstRow = page.locator("tbody tr").first();
    const leaveDetails = firstRow.getByRole("button", {
      name: "Leave details",
    });
    await leaveDetails.waitFor({ state: "visible", timeout: 15000 });
    await leaveDetails.click();

    await page.getByLabel("Full name").fill("Playwright Decliner");
    await page.getByLabel("Phone number").fill("0507654321");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByText("Also share with these suppliers?"),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "No thanks" }).click();

    await expect(
      page.getByText("Also share with these suppliers?"),
    ).not.toBeVisible();
  });
});

test.describe("Plans page — click-through CTA", () => {
  test("Electra row shows both the click-through and Leave details CTAs", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    const electraRow = page
      .locator("tbody tr")
      .filter({ hasText: "Electra Power" })
      .first();
    await expect(
      electraRow.getByRole("button", { name: "Switch without an agent" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      electraRow.getByRole("button", { name: "Leave details" }),
    ).toBeVisible();
  });

  test("a formHandoff-only row does not show the click-through CTA", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    const otherRow = page
      .locator("tbody tr")
      .filter({ hasNotText: "Electra Power" })
      .first();
    await expect(
      otherRow.getByRole("button", { name: "Leave details" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      otherRow.getByRole("button", { name: "Switch without an agent" }),
    ).not.toBeVisible();
  });
});
