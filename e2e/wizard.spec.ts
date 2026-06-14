import { test, expect, type Page } from "@playwright/test";

// Navigate to the Usage step via the no-smart-meter path (Meter → Home → Usage)
async function navigateToUsageStep(page: Page) {
  await page.goto("/wizard");

  // Step 0: Meter — pick Standard meter
  await page.getByText("Standard meter").click();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 1 (display): Home — no required fields, just advance
  await expect(page.getByRole("heading", { name: "Your Home" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // Should now be on Usage step
  await expect(
    page.getByRole("heading", { name: "How You Use Electricity" }),
  ).toBeVisible();
}

test.describe("Full wizard flow", () => {
  test("completes without 'Error generating recommendation'", async ({
    page,
  }) => {
    await navigateToUsageStep(page);

    await page.getByRole("button", { name: "Get My Recommendation" }).click();

    const errorMsg = page.getByText(
      "Error generating recommendation. Please try again.",
    );
    await page.waitForTimeout(15000);
    await expect(errorMsg).not.toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Your Recommendation" }),
    ).toBeVisible();
  });

  test("Pazgaz Yellow Accumulation not recommended when off-bill benefits declined", async ({
    page,
  }) => {
    await navigateToUsageStep(page);

    // Decline off-bill benefits
    await page.locator('input[name="offbill"]').nth(1).click();
    await expect(page.locator('input[name="offbill"]').nth(1)).toBeChecked();

    await page.getByRole("button", { name: "Get My Recommendation" }).click();

    await expect(
      page.getByRole("heading", { name: "Your Recommendation" }),
    ).toBeVisible({ timeout: 20000 });

    // The appCredit plan must not appear anywhere in the recommendation cards
    await expect(
      page.getByText("Pazgaz Yellow Accumulation"),
    ).not.toBeVisible();
  });
});

test.describe("Usage step — Off-Bill Benefit Willingness question", () => {
  test("off-bill question appears as the last fieldset", async ({ page }) => {
    await navigateToUsageStep(page);

    const legend = page.getByText(
      "Are you open to savings as partner app credits?",
    );
    await expect(legend).toBeVisible();

    // Verify it is the last fieldset on the step
    const fieldsets = page.locator("fieldset");
    const count = await fieldsets.count();
    const lastLegend = await fieldsets
      .nth(count - 1)
      .locator("legend")
      .textContent();
    expect(lastLegend).toContain(
      "Are you open to savings as partner app credits?",
    );
  });

  test("off-bill question defaults to Yes selected", async ({ page }) => {
    await navigateToUsageStep(page);

    // Both radios should be present; Yes should be checked by default
    const yesRadio = page.locator('input[name="offbill"]').nth(0);
    const noRadio = page.locator('input[name="offbill"]').nth(1);

    await expect(yesRadio).toBeChecked();
    await expect(noRadio).not.toBeChecked();
  });

  test("selecting No persists to the review panel on results step", async ({
    page,
  }) => {
    await navigateToUsageStep(page);

    // Select No for off-bill benefits
    await page.locator('input[name="offbill"]').nth(1).click();
    const noRadio = page.locator('input[name="offbill"]').nth(1);
    await expect(noRadio).toBeChecked();

    // Submit — go to results step (backend call will happen; wait for it or check review panel)
    await page.getByRole("button", { name: "Get My Recommendation" }).click();

    // The review panel at the bottom mirrors usage fields with a "review_" prefix name
    // Check that the No radio is still selected in the review copy
    await expect(
      page.locator('input[name="review_offbill"]').nth(1),
    ).toBeChecked();
  });
});
