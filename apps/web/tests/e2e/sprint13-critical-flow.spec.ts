import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("auth → inventory → scan → review → recipes → favorite → calendar → paywall", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires local Supabase auth");
  const email = `sprint13-${Date.now()}@example.test`;
  const password = "sprint13-test-password";
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByRole("heading", { name: "Tu nevera" })).toBeVisible();

  await page.route("**/api/ocr", route => route.fulfill({ json: {
    draftId: "51000000-0000-4000-a000-000000000001",
    requestId: "52000000-0000-4000-a000-000000000001",
    status: "review",
    draft: { merchant: "Demo", purchaseDate: null, currency: "EUR", total: "1.00", items: [{ lineId: "a", rawText: "TOMATE 1.00", name: "Tomate", quantity: "1", unit: "unit", unitPrice: null, totalPrice: "1.00", confidence: .8, accepted: true }], unrecognizedLines: [] },
  } }));
  await page.route("**/api/ocr/confirm", route => route.fulfill({ json: { draftId: "51000000-0000-4000-a000-000000000001", status: "confirmed", itemIds: ["one"] } }));
  await page.getByRole("link", { name: "Escanear" }).click();
  await expect(page.getByRole("heading", { name: "Escanea tu compra" })).toBeVisible();
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: readFileSync("public/icons/icon-192.png") });
  await page.getByRole("button", { name: "Usar este recorte" }).click();
  await expect(page.getByRole("heading", { name: "Revisa cada línea" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar artículos" }).click();
  await expect(page.getByText(/guardaron una sola vez/i)).toBeVisible();

  await page.route("**/api/recipes/suggestions", route => route.fulfill({ json: {
    contract: "recipe-suggestions-v1", recipes: [{ id: "r1", name: "Sopa de tomate", matchPercentage: 100, matchedIngredients: ["tomate"], missingIngredients: [], ingredientsWithMeasures: ["1 tomate"], instructions: "Cocer." }], inventoryHash: "x", catalogVersion: "fixture", matcherVersion: "matcher-v1", inventoryEmpty: false, cache: { hit: false, expiresAt: new Date(Date.now() + 3600000).toISOString() },
  } }));
  await page.route("**/api/favorites", route => {
    const request = route.request().postDataJSON();
    return route.fulfill({ json: { client_mutation_id: request.client_mutation_id, status: "applied", code: "OK", result: { id: "f1", recipe_id: request.recipe_id, snapshot: request.snapshot, snapshot_version: 1, version: 1, saved_at: new Date().toISOString(), deleted_at: null }, conflicts: [] } });
  });
  await page.getByRole("link", { name: "Recetas", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Sopa de tomate" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar receta" }).click();
  await expect(page.getByRole("button", { name: "Guardada" })).toBeVisible();
  await page.getByRole("link", { name: "Comidas", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Comidas" })).toBeVisible();
  await page.goto("/app/pro");
  await expect(page.locator("main").first()).toBeVisible();
});
