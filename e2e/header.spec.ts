import { test, expect } from "@playwright/test";

test.describe("Header — server-rendered, no flash", () => {
  test("home page HTML includes header markup before any JS runs", async ({
    request,
  }) => {
    const res = await request.get("/");
    const html = await res.text();
    expect(html).toMatch(
      /<header[^>]*>[\s\S]*aria-label="Chisko"[\s\S]*<\/header>/,
    );
  });
});

test.describe("Header — brand link", () => {
  test("on a locale-prefixed route, the brand link points to that locale's home", async ({
    request,
  }) => {
    const res = await request.get("/en/");
    const html = await res.text();
    expect(html).toMatch(/<a href="\/en\/" aria-label="Chisko"/);
  });

  test("on the default Hebrew route, the brand link points to /", async ({
    request,
  }) => {
    const res = await request.get("/");
    const html = await res.text();
    expect(html).toMatch(/<a href="\/" aria-label="Chisko"/);
  });
});

test.describe("Header — language switcher", () => {
  test("on a non-wizard route, selecting a language navigates and sets the cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.selectOption("#chisko-lang-select", "en");
    await page.waitForURL("**/en/**");

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "chisko_lang")?.value).toBe("en");
  });

  test("on /wizard, selecting a language updates text in place without navigating", async ({
    page,
  }) => {
    await page.goto("/wizard");
    await expect(page.getByText("מד", { exact: true })).toBeVisible();

    await page.selectOption("#chisko-lang-select", "en");

    await expect(page.getByText("Meter", { exact: true })).toBeVisible();
    expect(page.url()).toContain("/wizard");
    expect(page.url()).not.toContain("lang=en");
  });

  test("on /wizard, selecting a language updates the document dir and lang attributes", async ({
    page,
  }) => {
    await page.goto("/wizard");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.selectOption("#chisko-lang-select", "en");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("Header — theme menu", () => {
  test("selecting a theme toggles the dark class and persists to localStorage", async ({
    page,
  }) => {
    await page.goto("/en/");
    await page.locator('summary[aria-label="Theme"]').click();
    await page.getByRole("button", { name: "Dark" }).click();

    await expect(page.locator("html")).toHaveClass(/dark/);
    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    expect(stored).toBe("dark");
  });

  test("theme options render icons, not emoji glyphs", async ({ page }) => {
    await page.goto("/en/");
    await page.locator("details summary").click();

    const optionsHtml = await page
      .locator("[data-theme-option]")
      .evaluateAll((els) => els.map((el) => el.innerHTML));

    for (const html of optionsHtml) {
      expect(html).toContain("<svg");
    }
  });
});
