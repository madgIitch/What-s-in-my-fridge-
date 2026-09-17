import { expect, test } from "@playwright/test";

test("shows the mobile-first pantry shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Buenos días/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Navegación principal/ })).toBeVisible();
});
