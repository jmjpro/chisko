import { test, expect } from "@playwright/test";

test.describe("Locale routing — html attributes", () => {
  test("Hebrew root / has dir=rtl and lang=he", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
  });

  test("English /en/ has dir=ltr and lang=en", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Arabic /ar/ has dir=rtl and lang=ar", async ({ page }) => {
    await page.goto("/ar/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("Russian /ru/ has dir=ltr and lang=ru", async ({ page }) => {
    await page.goto("/ru/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });
});

test.describe("Locale routing — wizard", () => {
  test("Hebrew /wizard has dir=rtl", async ({ page }) => {
    await page.goto("/wizard");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
  });

  test("English /en/wizard has dir=ltr", async ({ page }) => {
    await page.goto("/en/wizard");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
