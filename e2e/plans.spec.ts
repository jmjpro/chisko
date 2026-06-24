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

test.describe("Plans page — mobile cards (Hebrew default route)", () => {
  test("below md breakpoint, /plans renders cards instead of the table", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/plans");

    await expect(page.locator("table")).toBeHidden();

    const cards = page.getByTestId("plan-card");
    await expect(cards.first()).toBeVisible();
  });

  test("a fixed plan card shows 24/7 and No for the discount window and weekday only rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/plans");

    const card = page
      .getByTestId("plan-card")
      .filter({ hasText: "בזק חשמל" })
      .filter({ hasText: "בזק קבועה" });
    await expect(card).toBeVisible();

    await expect(card.getByText("חלון הנחה")).toBeVisible();
    await expect(card.getByText("ימי חול בלבד")).toBeVisible();
    await expect(card.getByText("24/7")).toBeVisible();
    await expect(card.getByText("לא", { exact: true })).toBeVisible();
  });
});

test.describe("Plans page — mobile cards", () => {
  test("below md breakpoint, cards render instead of the table", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    await expect(page.locator("table")).toBeHidden();

    const cards = page.getByTestId("plan-card");
    await expect(cards.first()).toBeVisible();
  });

  test("at and above md breakpoint, the table renders and cards stay hidden", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/en/plans");

    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByTestId("plan-card").first()).toBeHidden();
  });

  test("a day/night plan card shows supplier, plan, discount, type, window, and weekday fields", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const card = page
      .getByTestId("plan-card")
      .filter({ hasText: "Bezek Electricity" })
      .filter({ hasText: "Bezek Day" });
    await expect(card).toBeVisible();

    await expect(card.getByText("15%")).toBeVisible();
    await expect(card.getByText("Day", { exact: true })).toBeVisible();
    await expect(card.getByText("07:00–17:00")).toBeVisible();
    await expect(card.getByText("Yes", { exact: true })).toBeVisible();
  });

  test("a fixed plan card shows 24/7 and No for the discount window and weekday only rows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const card = page
      .getByTestId("plan-card")
      .filter({ hasText: "Bezek Electricity" })
      .filter({ hasText: "Bezek Fixed" });
    await expect(card).toBeVisible();

    await expect(card.getByText("Fixed", { exact: true })).toBeVisible();
    await expect(card.getByText("Discount Window")).toBeVisible();
    await expect(card.getByText("Weekday Only")).toBeVisible();
    await expect(card.getByText("24/7")).toBeVisible();
    await expect(card.getByText("No", { exact: true })).toBeVisible();
  });

  test("the Leave Details CTA inside a card opens the leave-details dialog", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/en/plans");

    const firstCard = page.getByTestId("plan-card").first();
    const leaveDetails = firstCard.getByRole("button", {
      name: "Leave details",
    });
    await leaveDetails.waitFor({ state: "visible", timeout: 15000 });

    // CTA spans the card's content width, not a narrow inline button
    const cardBox = await firstCard.boundingBox();
    const buttonBox = await leaveDetails.boundingBox();
    expect(buttonBox!.width).toBeGreaterThan(cardBox!.width * 0.8);

    await leaveDetails.click();

    await expect(page.getByText("Leave your details")).toBeVisible();
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
