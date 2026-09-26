import { expect, test } from "@playwright/test";

test("shows the public entry with working auth links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Todo lo que tienes/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Crear cuenta/i })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: /Ya tengo cuenta/i })).toHaveAttribute("href", "/login");
});
