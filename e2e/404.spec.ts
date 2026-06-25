import { test, expect } from "@playwright/test";

test.describe("404 page — per locale", () => {
  test("Hebrew (default, unprefixed) shows localized 404 with dir=rtl", async ({
    page,
    baseURL,
  }) => {
    // Pin the locale explicitly via the cookie middleware.ts reads (see
    // src/lib/locale.ts's LANG_COOKIE) — the browser's own Accept-Language
    // would otherwise decide which unprefixed-locale redirect fires here,
    // which is the unrelated, separately-tracked flakiness CHI-85 covers.
    await page.context().addCookies([
      { name: "chisko_lang", value: "he", url: baseURL },
    ]);
    await page.goto("/asdkjasd");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page).toHaveTitle("Chisko — הדף לא נמצא");
  });

  test("English unmatched path under /en/ rewrites to the English 404", async ({
    page,
  }) => {
    await page.goto("/en/asdkjasd");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Chisko — Page not found");
  });

  test("Arabic unmatched path under /ar/ rewrites to the Arabic 404", async ({
    page,
  }) => {
    await page.goto("/ar/asdkjasd");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page).toHaveTitle("Chisko — الصفحة غير موجودة");
  });

  test("Russian unmatched path under /ru/ rewrites to the Russian 404", async ({
    page,
  }) => {
    await page.goto("/ru/asdkjasd");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page).toHaveTitle("Chisko — Страница не найдена");
  });
});

test.describe("404 page — home link", () => {
  test("the home link on the English 404 page navigates to the English home page", async ({
    page,
  }) => {
    await page.goto("/en/asdkjasd");
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/en\/$/);
  });
});

test.describe("404 page — regression guard", () => {
  test("/en/plans (a real top-level route) still renders the Plans page, not the 404 page", async ({
    page,
  }) => {
    await page.goto("/en/plans");
    await expect(page.locator("table")).toBeVisible();
    await expect(page).not.toHaveTitle("Chisko — Page not found");
  });
});
