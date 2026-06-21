import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = path.join(__dirname, "fixtures", "smartMeterSample.csv");

// CHI-47: the smart-meter CSV is parsed entirely client-side and never
// uploaded — this drives the real browser file input and confirms the whole
// flow (parse -> submitSmartMeterCsv -> generate) still produces a
// High Confidence recommendation, with no network upload involved.
test("smart-meter CSV is parsed client-side and produces a recommendation", async ({
  page,
}) => {
  await page.goto("/en/wizard");

  // Step 0: Meter — pick Smart meter
  await page.getByText("Smart meter").click();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 1: Upload
  await expect(
    page.getByRole("heading", { name: "Upload Smart Meter File" }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(SAMPLE_CSV);

  await expect(page.getByText("File processed successfully")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();

  // Step 2: Home — no required fields, advance
  await expect(page.getByRole("heading", { name: "Your Home" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 3: Usage — advance to results
  await expect(
    page.getByRole("heading", { name: "How You Use Electricity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get My Recommendation" }).click();

  await expect(
    page.getByRole("heading", { name: "Your Recommendation" }),
  ).toBeVisible({ timeout: 20000 });

  // High Confidence only happens when the bill import's bucketed usage made it through
  await expect(page.getByText("Confidence: High")).toBeVisible();
});
