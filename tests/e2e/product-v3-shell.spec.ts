import { expect, test } from "@playwright/test";

test("R0 shell keeps five destinations and safe legacy collection links", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E || process.env.PRODUCT_V3 !== "true", "requires local Supabase and PRODUCT_V3=true");
  await page.setViewportSize({ width: 320, height: 720 });
  const email = `r0-${Date.now()}@example.test`;
  const password = "r0-test-password";
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await expect(page).toHaveURL(/\/signup\?status=check_email/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/app(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "¿Qué cocinamos hoy?" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.getByRole("link", { name: "Hoy" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Despensa" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Cocinar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Compra" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Añadir" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Favoritos|Calendar/ })).toHaveCount(0);
  await nav.getByRole("button", { name: "Añadir" }).click();
  await expect(nav.getByRole("link", { name: "Escanear ticket" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Añadir alimento" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/app/recipes?q=tarta&page=2&evil=ignored");
  await expect(page).toHaveURL(/\/app\/cook\?view=today&q=tarta&page=2$/);
  await page.goto("/app/favorites?q=sopa&page=3&token=secret");
  await expect(page).toHaveURL(/\/app\/cook\?view=saved&q=sopa&page=3$/);
  await page.goto("/app/pantry");
  await expect(page.getByRole("heading", { name: "Lo que tienes" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("R0 flag off keeps the existing inventory entry", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E || process.env.PRODUCT_V3 !== "false", "requires local Supabase and PRODUCT_V3=false");
  const email = `r0-legacy-${Date.now()}@example.test`;
  const password = "r0-test-password";
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await expect(page).toHaveURL(/\/signup\?status=check_email/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByRole("heading", { name: /Mi Nevera/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Acciones del inventario" })).toBeVisible();
});
