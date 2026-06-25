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

test.describe("Locale routing — Accept-Language redirect", () => {
  test.use({ locale: "en-US" });

  test("a non-Hebrew browser locale redirects / to the matching locale prefix", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/$/);
  });
});

test.describe("Locale routing — page titles", () => {
  test("home page title per locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Chisko — שלם פחות על אותו חשמל");

    await page.goto("/en/");
    await expect(page).toHaveTitle(
      "Chisko — Pay less for the same electricity",
    );

    await page.goto("/ar/");
    await expect(page).toHaveTitle("Chisko — ادفع أقل مقابل نفس الكهرباء");

    await page.goto("/ru/");
    await expect(page).toHaveTitle(
      "Chisko — Платите меньше за ту же электроэнергию",
    );
  });

  test("wizard page title per locale", async ({ page }) => {
    await page.goto("/wizard");
    await expect(page).toHaveTitle("Chisko — אשף");

    await page.goto("/en/wizard");
    await expect(page).toHaveTitle("Chisko — Wizard");

    await page.goto("/ar/wizard");
    await expect(page).toHaveTitle("Chisko — المعالج");

    await page.goto("/ru/wizard");
    await expect(page).toHaveTitle("Chisko — Мастер");
  });
});
