import { expect, test } from "@playwright/test";

for (const width of [320, 375, 430, 768, 1024, 1440]) {
  test(`login fits ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Qué bien verte." })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByLabel("Email").focus();
    expect(await page.getByLabel("Email").evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  });
}

test("private detail keeps its local return path", async ({ page }) => {
  await page.goto("/app/items/new?from=scan");
  await expect(page).toHaveURL(/\/login\?/);
  const returnTo = new URL(page.url()).searchParams.get("returnTo");
  expect(returnTo).toBe("/app/items/new?from=scan");
});
