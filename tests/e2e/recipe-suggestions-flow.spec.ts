import { expect, test } from "@playwright/test";

test.describe("recipe suggestions mobile", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires local Supabase auth");
  test.beforeEach(async ({ page }) => {
    const email = `recipes-${Date.now()}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("recipe-test-password");
    await page.getByRole("button", { name: /Crear cuenta/ }).click();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("recipe-test-password");
    await page.getByRole("button", { name: /Entrar/ }).click();
  });
  test("renders results, cache metadata and blocks a double refresh", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/recipes/suggestions", async (route) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      await route.fulfill({ json: { contract: "recipe-suggestions-v1", recipes: [{ id: "one", name: "Tomato soup", matchPercentage: 75, matchedIngredients: ["tomato"], missingIngredients: ["salt"], ingredientsWithMeasures: ["2 tomatoes", "1 tsp salt"], instructions: "Blend and simmer." }], inventoryHash: "a".repeat(64), catalogVersion: "fixture", matcherVersion: "matcher-v1", inventoryEmpty: false, cache: { hit: calls > 1, expiresAt: new Date(Date.now() + 3600000).toISOString() } } });
    });
    await page.goto("/app/recipes");
    await expect(page.getByRole("heading", { name: "Tomato soup" })).toBeVisible();
    await expect(page.getByText("75%")).toBeVisible();
    await page.getByRole("button", { name: "Actualizar sugerencias" }).dblclick();
    await expect(page.getByText(/no consume cuota/i)).toBeVisible();
    expect(calls).toBe(2);
  });
  test("shows empty, quota and retryable states", async ({ page }) => {
    await page.route("**/api/recipes/suggestions", (route) => route.fulfill({ status: 429, json: { code: "SUGGESTION_QUOTA_EXHAUSTED", message: "Cuota agotada", retryable: false } }));
    await page.goto("/app/recipes");
    await expect(page.getByRole("heading", { name: "Límite mensual alcanzado" })).toBeVisible();
  });
});
