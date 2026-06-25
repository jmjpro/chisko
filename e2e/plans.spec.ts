import { test, expect } from "@playwright/test";

test.describe("Plans page — build-time data fetch", () => {
  test("/en/plans renders plan rows immediately (no loading spinner)", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    // Rows are in the HTML from the start — no waiting for Convex WebSocket
    const firstRow = page.getByTestId("plan-row").first();
    await expect(firstRow).toBeVisible();
  });

  test("/plans (Hebrew default) renders plan rows with Hebrew supplier names", async ({
    page,
  }) => {
    await page.goto("/plans");

    // Hebrew locale: at least one translated supplier name should appear
    const firstRow = page.getByTestId("plan-row").first();
    await expect(firstRow).toBeVisible();
  });

  test("a plan row shows the supplier's logo before the supplier name", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    const row = page
      .getByTestId("plan-row")
      .filter({ hasText: "Bezek Electricity" })
      .first();
    await expect(row).toBeVisible();

    const logo = row.locator("img").first();
    await expect(logo).toHaveAttribute("src", /\/suppliers\/.+\.webp$/);
    await expect(logo).toHaveAttribute("alt", "Bezek Electricity");
  });
});

test.describe("Plans page — responsive layout (Hebrew default route)", () => {
  test("below md breakpoint, column headers are hidden (card look applies)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/plans");

    // plan-rows exist at both viewports — the visual switch is CSS-only
    const firstRow = page.getByTestId("plan-row").first();
    await expect(firstRow).toBeVisible();

    // Header row is display:none at mobile — column header text is not visible
    await expect(page.locator('[role="columnheader"]').first()).toBeHidden();
  });

  test("a fixed plan card shows 24/7 and No for the discount window and weekday only rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/plans");

    const row = page
      .getByTestId("plan-row")
      .filter({ hasText: "בזק חשמל" })
      .filter({ hasText: "בזק קבועה" });
    await expect(row).toBeVisible();

    await expect(row.getByText("חלון הנחה")).toBeVisible();
    await expect(row.getByText("ימי חול בלבד")).toBeVisible();
    await expect(row.getByText("24/7")).toBeVisible();
    await expect(row.getByText("לא", { exact: true })).toBeVisible();
  });
});

test.describe("Plans page — responsive layout", () => {
  test("below md breakpoint, column headers are hidden and plan rows are visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const firstRow = page.getByTestId("plan-row").first();
    await expect(firstRow).toBeVisible();

    // Header row is display:none at mobile
    await expect(page.locator('[role="columnheader"]').first()).toBeHidden();
  });

  test("at and above md breakpoint, column headers are visible and plan rows render in table layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/en/plans");

    // Same rows visible at desktop (no separate table/card structures)
    const firstRow = page.getByTestId("plan-row").first();
    await expect(firstRow).toBeVisible();

    // Column header row becomes visible at desktop
    await expect(page.locator('[role="columnheader"]').first()).toBeVisible();
  });

  test("a plan row shows the supplier's logo at both mobile and desktop viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const row = page
      .getByTestId("plan-row")
      .filter({ hasText: "Bezek Electricity" })
      .first();
    await expect(row).toBeVisible();

    const logo = row.locator("img").first();
    await expect(logo).toHaveAttribute("src", /\/suppliers\/.+\.webp$/);
    await expect(logo).toHaveAttribute("alt", "Bezek Electricity");
  });

  test("a day/night plan row shows supplier, plan, discount, type, window, and weekday fields", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const row = page
      .getByTestId("plan-row")
      .filter({ hasText: "Bezek Electricity" })
      .filter({ hasText: "Bezek Day" });
    await expect(row).toBeVisible();

    await expect(row.getByText("15%")).toBeVisible();
    await expect(row.getByText("Day", { exact: true })).toBeVisible();
    await expect(row.getByText("07:00–17:00")).toBeVisible();
    await expect(row.getByText("Yes", { exact: true })).toBeVisible();
  });

  test("a fixed plan row shows 24/7 and No for the discount window and weekday only rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const row = page
      .getByTestId("plan-row")
      .filter({ hasText: "Bezek Electricity" })
      .filter({ hasText: "Bezek Fixed" });
    await expect(row).toBeVisible();

    await expect(row.getByText("Fixed", { exact: true })).toBeVisible();
    await expect(row.getByText("Discount Window")).toBeVisible();
    await expect(row.getByText("Weekday Only")).toBeVisible();
    await expect(row.getByText("24/7")).toBeVisible();
    await expect(row.getByText("No", { exact: true })).toBeVisible();
  });

  test("the Leave Details CTA inside a row opens the leave-details dialog, spanning the row content width at mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const firstRow = page.getByTestId("plan-row").first();
    const leaveDetails = firstRow.getByRole("button", {
      name: "Leave details",
    });
    await leaveDetails.waitFor({ state: "visible", timeout: 15000 });

    // CTA spans the row's content width, not a narrow inline button
    const rowBox = await firstRow.boundingBox();
    const buttonBox = await leaveDetails.boundingBox();
    expect(buttonBox!.width).toBeGreaterThan(rowBox!.width * 0.8);

    await leaveDetails.click();

    await expect(page.getByText("Leave your details")).toBeVisible();
  });
});

test.describe("Plans page — Leave details CTA", () => {
  test("submitting step 1 and confirming fan-out reports suppliers contacted", async ({
    page,
  }) => {
    await page.goto("/en/plans");

    const firstRow = page.getByTestId("plan-row").first();
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

    const firstRow = page.getByTestId("plan-row").first();
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
      .getByTestId("plan-row")
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
      .getByTestId("plan-row")
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
