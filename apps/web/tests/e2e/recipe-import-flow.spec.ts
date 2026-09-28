import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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

  test("owner can correct and restore an imported recipe without overwriting its source", async ({ page }) => {
    test.skip(!process.env.LOCAL_QUALITY_SERVICE_KEY || process.env.RECIPE_IMPORT_REVIEW_ENABLED !== "true", "requires isolated local quality flags");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!url.startsWith("http://127.0.0.1:") && !url.startsWith("http://localhost:")) throw new Error("LOCAL_DATABASE_REQUIRED");
    const admin = createClient(url, process.env.LOCAL_QUALITY_SERVICE_KEY!, { global: { headers: process.env.LOCAL_QUALITY_ADMIN_JWT ? { Authorization: `Bearer ${process.env.LOCAL_QUALITY_ADMIN_JWT}` } : {} } });
    const email = `quality-${crypto.randomUUID()}@example.test`;
    const password = "local-quality-test-password";
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("LOCAL_USER_SETUP_FAILED");
    const userId = created.data.user.id;
    const id = crypto.randomUUID();
    try {
      const source = { schemaVersion: "recipe-v1", title: "Tortilla original", ingredients: [{ name: "Huevo" }], steps: ["Batir los huevos."], source: { type: "manual" }, provenance: { quality: { status: "review_required" } } };
      const inserted = await admin.from("recipe_import_jobs").insert({ id, user_id: userId, idempotency_key: `quality-e2e-${id}`, source_type: "manual", manual_text: "Batir los huevos.", state: "completed", result: source });
      if (inserted.error) throw new Error("LOCAL_JOB_SETUP_FAILED");
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: /Entrar/ }).click();
      await expect(page).toHaveURL(/\/app/);
      await page.setViewportSize({ width: 393, height: 852 });
      await page.goto(`/app/recipes/import/${id}`);
      await expect(page.getByText("Cantidad no indicada")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Revisa esta receta" })).toBeVisible();
      await page.getByRole("button", { name: "Corregir receta" }).click();
      await page.getByLabel("Título", { exact: true }).fill("Mi tortilla corregida");
      await page.getByRole("button", { name: "Guardar mi versión" }).click();
      await expect(page.getByRole("heading", { name: "Mi tortilla corregida" })).toBeVisible();
      const original = await admin.from("recipe_import_jobs").select("result").eq("id", id).single();
      expect(original.data?.result.title).toBe("Tortilla original");
      await page.getByRole("button", { name: "Restaurar receta original" }).click();
      await expect(page.getByRole("heading", { name: "Tortilla original" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= 393)).toBe(true);
    } finally { await admin.auth.admin.deleteUser(userId); }
  });
});
