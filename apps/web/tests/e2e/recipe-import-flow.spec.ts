import { expect, test } from "@playwright/test";

test.describe("mobile recipe import against local Supabase", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires the local Supabase stack");

  test("paste fallback remains recoverable at 320px", async ({ page }) => {
    const email = `recipe-import-${Date.now()}@example.test`;
    const password = "recipe-import-test-password";
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Crear cuenta/ }).click();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/app/);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/app/recipes/import?url=https%3A%2F%2Fexample.com%2Frecipe");
    await expect(page.getByRole("heading", { name: /Trae una receta/ })).toBeVisible();
    await expect(page.getByLabel("Enlace")).toHaveValue("https://example.com/recipe");
    await expect(page.getByText("Importaciones recientes")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
  });
});
