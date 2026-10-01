import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "../../apps/web/node_modules/@supabase/supabase-js";

const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = (() => { try { return ["127.0.0.1", "localhost"].includes(new URL(localUrl).hostname); } catch { return false; } })();
const canRun = Boolean(process.env.RUN_LOCAL_SUPABASE_E2E && process.env.PRODUCT_V3 === "true" && isLocal && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const password = "r2-local-test-password";
const conceptIds = { egg: "b2000000-0000-4000-a000-000000000001", tomato: "b2000000-0000-4000-a000-000000000002", onion: "b2000000-0000-4000-a000-000000000003" };
const recipeIds = { ready: "b4000000-0000-4000-a000-000000000001", quantity: "b4000000-0000-4000-a000-000000000002", missing: "b4000000-0000-4000-a000-000000000003", many: "b4000000-0000-4000-a000-000000000004", unknown: "b4000000-0000-4000-a000-000000000005" };

function adminClient() { if (!isLocal) throw new Error("R2 fixtures require localhost Supabase"); return createClient(localUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function createUser(_admin: SupabaseClient, page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  // Current local Supabase uses asymmetric signing keys. Its legacy HS256
  // service-role JWT is intentionally rejected by GoTrue, while local email
  // signup is enabled and auto-confirmed in config.toml. Create the browser
  // identity through that supported public path and keep the secret key only
  // for local PostgREST fixture writes.
  const signup = createClient(localUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await signup.auth.signUp({ email, password }); if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
  await page.goto("/login"); await page.getByLabel("Email").fill(email); await page.getByLabel("Contraseña").fill(password); await page.getByRole("button", { name: /Entrar/ }).click(); await expect(page).toHaveURL(/\/app(?:\?|$)/);
  return created.data.user.id;
}
async function ensureCatalog(admin: SupabaseClient) {
  await admin.from("food_concepts").upsert([
    { id: conceptIds.egg, slug: "r2-e2e-eggs", display_name: "Huevos" }, { id: conceptIds.tomato, slug: "r2-e2e-tomato", display_name: "Tomate" }, { id: conceptIds.onion, slug: "r2-e2e-onion", display_name: "Cebolla" },
  ]);
  const active = await admin.from("catalog_versions").select("id").eq("active", true).maybeSingle();
  let catalogId = active.data?.id as string | undefined;
  if (!catalogId) {
    catalogId = "b3000000-0000-4000-a000-000000000001";
    const inserted = await admin.from("catalog_versions").insert({ id: catalogId, checksum: "c".repeat(64), source_version: "r2-e2e", matcher_version: "matcher-r2", active: true, recipe_count: 5, ingredient_count: 8 }); if (inserted.error) throw inserted.error;
  }
  const recipes = [
    { id: recipeIds.ready, external_id: "r2-ready", name: "Tortilla rápida" }, { id: recipeIds.quantity, external_id: "r2-quantity", name: "Huevos al gusto" }, { id: recipeIds.missing, external_id: "r2-missing", name: "Huevos con tomate" }, { id: recipeIds.many, external_id: "r2-many", name: "Huevos con huerta" }, { id: recipeIds.unknown, external_id: "r2-unknown", name: "Receta misteriosa" },
  ].map((recipe) => ({ ...recipe, catalog_version_id: catalogId, instructions: "Cocinar con cuidado.", metadata: {} }));
  const recipeWrite = await admin.from("recipes").upsert(recipes); if (recipeWrite.error) throw recipeWrite.error;
  const ingredients = [
    ["b5000000-0000-4000-a000-000000000001", recipeIds.ready, 0, "Huevos", "huevos", "1 unit", conceptIds.egg],
    ["b5000000-0000-4000-a000-000000000002", recipeIds.quantity, 0, "Huevos", "huevos", "al gusto", conceptIds.egg],
    ["b5000000-0000-4000-a000-000000000003", recipeIds.missing, 0, "Huevos", "huevos", "1 unit", conceptIds.egg],
    ["b5000000-0000-4000-a000-000000000004", recipeIds.missing, 1, "Tomate", "tomate", "1 unit", conceptIds.tomato],
    ["b5000000-0000-4000-a000-000000000005", recipeIds.many, 0, "Huevos", "huevos", "1 unit", conceptIds.egg],
    ["b5000000-0000-4000-a000-000000000006", recipeIds.many, 1, "Tomate", "tomate", "1 unit", conceptIds.tomato],
    ["b5000000-0000-4000-a000-000000000007", recipeIds.many, 2, "Cebolla", "cebolla", "1 unit", conceptIds.onion],
    ["b5000000-0000-4000-a000-000000000008", recipeIds.unknown, 0, "Ingrediente secreto", "ingrediente secreto", "1 unit", null],
  ].map(([id, recipe_id, position, name, normalized_name, measure, food_concept_id]) => ({ id, recipe_id, position, name, normalized_name, measure, food_concept_id }));
  const ingredientWrite = await admin.from("recipe_ingredients").upsert(ingredients); if (ingredientWrite.error) throw ingredientWrite.error;
}
async function screenshot(page: Page, path: string) { await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish())); await page.screenshot({ path, fullPage: true }); }

test.describe("R2 Today with local authenticated data", () => {
  test.skip(!canRun, "requires explicitly local Supabase and PRODUCT_V3=true");
  test("real DB covers cache, Free changes, shopping snapshot, offline, TTMD and 320/393 evidence", async ({ page, context }) => {
    test.setTimeout(120_000); const admin = adminClient(); await ensureCatalog(admin); const userId = await createUser(admin, page, "r2-main");
    const pantryId = crypto.randomUUID();
    const inserted = await admin.from("inventory_items").insert({ id: pantryId, user_id: userId, name: "Huevos", expiry_date: "2026-10-03T12:00:00Z", quantity: 2, unit: "unit", added_at: "2026-10-02T09:00:00Z", food_concept_id: conceptIds.egg, normalization_status: "confirmed", normalization_source: "user", knowledge_provenance: "user", stock_mode: "exact", stock_state: "some", quantity_precision: "exact", quantity_exact: 2, quantity_unit: "unit", freshness_precision: "exact", freshness_source: "package", expiry_date_exact: "2026-10-03" }); if (inserted.error) throw inserted.error;
    await admin.from("usage_counters").upsert({ user_id: userId, feature: "recipe_suggestions", period: "2026-10-01", used: 999 });
    const legacyQuota = await admin.from("recipe_monthly_usage").upsert({ user_id: userId, period_start: "2026-10-01", consumed: 999 }); if (legacyQuota.error) throw legacyQuota.error;
    await page.addInitScript(() => { (window as unknown as { __todayMetrics: unknown[] }).__todayMetrics = []; window.addEventListener("neverita:today-metric", (event) => (window as unknown as { __todayMetrics: unknown[] }).__todayMetrics.push((event as CustomEvent).detail)); });
    await page.setViewportSize({ width: 393, height: 852 }); await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Tortilla rápida" })).toBeVisible(); await expect(page.getByText("Cantidad por comprobar", { exact: true })).toBeVisible(); await expect(page.getByText("Te falta 1")).toBeVisible();
    const firstAction = page.getByRole("link", { name: "Cocinar esto" }).first(); await expect(firstAction).toHaveAttribute("href", `/app/recipes/${recipeIds.ready}`);
    const actionBox = (await firstAction.boundingBox())!;
    expect(actionBox.height).toBeGreaterThanOrEqual(44); expect(actionBox.y + actionBox.height).toBeLessThan(740);
    const secondary = page.getByRole("heading", { name: "También podrías aprovechar" }); if (await secondary.count()) expect(actionBox.y).toBeLessThan((await secondary.boundingBox())!.y);
    await screenshot(page, "../../docs/design/neverita-v3/qa/r2-today-393.png");
    const metrics = await page.evaluate(() => (window as unknown as { __todayMetrics: Array<Record<string, unknown>> }).__todayMetrics);
    expect(metrics.map((metric) => metric.phase)).toEqual(["opened", "decision_visible"]); expect(metrics.some((metric) => "userId" in metric || "recipeId" in metric || "snapshotKey" in metric)).toBe(false);
    const firstPayload = await page.evaluate(async () => (await fetch("/api/recommendations/today?date=2026-10-02")).json()); const secondPayload = await page.evaluate(async () => (await fetch("/api/recommendations/today?date=2026-10-02")).json()); expect(secondPayload.snapshotKey).toBe(firstPayload.snapshotKey);
    const missingCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Huevos con tomate" }) }); await missingCard.getByRole("button", { name: "Añadir a la compra" }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Confirmar y añadir" }).click(); await expect(page.getByRole("link", { name: "Ver lista de compra" })).toBeVisible();
    const usageBefore = await admin.from("usage_counters").select("used").eq("user_id", userId).eq("feature", "recipe_suggestions").single();
    for (let quantity = 3; quantity <= 8; quantity += 1) { const update = await admin.from("inventory_items").update({ quantity, quantity_exact: quantity }).eq("id", pantryId); if (update.error) throw update.error; await page.reload(); await expect(page.getByRole("heading", { name: "Tortilla rápida" })).toBeVisible(); }
    const usageAfter = await admin.from("usage_counters").select("used").eq("user_id", userId).eq("feature", "recipe_suggestions").single(); expect(usageAfter.data?.used).toBe(usageBefore.data?.used);
    expect((await admin.from("recipe_monthly_usage").select("consumed").eq("user_id", userId).single()).data?.consumed).toBe(999);
    await page.setViewportSize({ width: 320, height: 720 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await screenshot(page, "../../docs/design/neverita-v3/qa/r2-uncertainty-320.png");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.locator(".today-decision").first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.001);
    const trigger = page.getByRole("button", { name: "Añadir a la compra" }).first();
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("button", { name: "Confirmar y añadir" })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    await context.setOffline(true); await expect(page.getByText("Resultado anterior · Sin conexión")).toBeVisible(); await expect(trigger).toBeDisabled(); await context.setOffline(false);
    await expect(page.getByText("Resultado anterior · Sin conexión")).toHaveCount(0);
    await page.getByRole("link", { name: "Cocinar esto" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/recipes/${recipeIds.ready}$`));
    await expect(page.getByRole("heading", { name: "Tortilla rápida" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible();
  });

  test("empty account onboarding and isolated example are real localhost states", async ({ page }) => {
    const admin = adminClient(); await ensureCatalog(admin); await createUser(admin, page, "r2-empty"); await page.setViewportSize({ width: 320, height: 720 }); await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Sabe lo que tienes/ })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await screenshot(page, "../../docs/design/neverita-v3/qa/r2-onboarding-320.png");
    await page.getByRole("button", { name: "Ver un ejemplo primero" }).click(); await expect(page.getByText(/Sus acciones están desactivadas/)).toBeVisible(); await expect(page.getByRole("button", { name: /Cocinar esto/ })).toBeDisabled();
  });

  test("real DB terminal states, unknown ingredients and error retry", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = adminClient(); await ensureCatalog(admin);
    const userId = await createUser(admin, page, "r2-real-states");
    const catalogId = crypto.randomUUID(); const recipeId = crypto.randomUUID(); const pantryId = crypto.randomUUID();
    const prior = await admin.from("catalog_versions").select("id").eq("active", true);
    const priorIds = (prior.data ?? []).map((row) => row.id);
    const check = (result: { error: unknown }) => { if (result.error) throw result.error; };
    try {
      await page.evaluate((id) => localStorage.setItem(`neverita:today-onboarding:${id}`, "seen"), userId);
      await page.setViewportSize({ width: 393, height: 852 }); await page.reload();
      await expect(page.getByRole("heading", { name: "Aún no sabemos qué tienes" })).toBeVisible();
      await screenshot(page, "../../docs/design/neverita-v3/qa/r2-empty-393.png");
      check(await admin.from("inventory_items").insert({ id: pantryId, user_id: userId, name: "Compra antigua por revisar", expiry_date: "2026-10-10", quantity: 1, unit: "unit", added_at: new Date().toISOString() }));
      await page.reload(); await expect(page.getByRole("heading", { name: "Revisa tu despensa" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Sabe lo que tienes/ })).toHaveCount(0);
      await screenshot(page, "../../docs/design/neverita-v3/qa/r2-unresolved-393.png");
      check(await admin.from("inventory_items").update({ food_concept_id: conceptIds.egg, normalization_status: "confirmed", normalization_source: "user", knowledge_provenance: "user", stock_mode: "exact", stock_state: "some", quantity_precision: "exact", quantity_exact: 2, quantity_unit: "unit" }).eq("id", pantryId));
      check(await admin.from("catalog_versions").insert({ id: catalogId, active: false, checksum: catalogId.replaceAll("-", "").repeat(2), source_version: `r2-state-${catalogId}`, matcher_version: "matcher-r2", recipe_count: 1, ingredient_count: 1 }));
      check(await admin.from("recipes").insert({ id: recipeId, catalog_version_id: catalogId, external_id: "r2-real-unknown", name: "Receta por comprobar", instructions: "Revisar antes de preparar" }));
      check(await admin.from("recipe_ingredients").insert({ recipe_id: recipeId, position: 0, name: `Ingrediente ${recipeId}`, normalized_name: `ingrediente ${recipeId}`, measure: "al gusto" }));
      if (priorIds.length) check(await admin.from("catalog_versions").update({ active: false }).in("id", priorIds));
      check(await admin.from("catalog_versions").update({ active: true }).eq("id", catalogId));
      await page.reload(); await expect(page.getByText("Hay ingredientes por comprobar")).toBeVisible();
      await expect(page.getByRole("link", { name: "Revisar receta" })).toHaveAttribute("href", `/app/recipes/${recipeId}`);
      await expect(page.getByRole("button", { name: "Añadir a la compra" })).toHaveCount(0);
      await screenshot(page, "../../docs/design/neverita-v3/qa/r2-unknown-393.png");
      check(await admin.from("recipes").update({ instructions: "" }).eq("id", recipeId));
      await page.setViewportSize({ width: 320, height: 720 }); await page.reload();
      await expect(page.getByRole("heading", { name: "No encontramos una opción clara" })).toBeVisible();
      await screenshot(page, "../../docs/design/neverita-v3/qa/r2-no-candidates-320.png");
      check(await admin.from("recipes").update({ instructions: "Revisar antes de preparar" }).eq("id", recipeId));
      let fail = true;
      await page.route("**/api/recommendations/today", (route) => fail
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "TODAY_UNAVAILABLE", retryable: true }) }) : route.continue());
      await page.reload(); await expect(page.getByRole("heading", { name: "No pudimos calcular Hoy" })).toBeVisible();
      fail = false; await page.getByRole("button", { name: "Reintentar" }).click();
      await expect(page.getByText("Hay ingredientes por comprobar")).toBeVisible();
    } finally {
      await admin.from("catalog_versions").update({ active: false }).eq("id", catalogId);
      if (priorIds.length) await admin.from("catalog_versions").update({ active: true }).in("id", priorIds);
      await admin.from("today_recommendation_cache").delete().eq("user_id", userId);
      await admin.from("inventory_items").delete().eq("user_id", userId);
      await admin.from("recipes").delete().eq("catalog_version_id", catalogId);
      await admin.from("catalog_versions").delete().eq("id", catalogId);
    }
  });

  test("authenticated UI renders every decision and terminal state without fabricated fallbacks", async ({ page }) => {
    const admin = adminClient(); await ensureCatalog(admin); const userId = await createUser(admin, page, "r2-states"); await page.evaluate((id) => localStorage.setItem(`neverita:today-onboarding:${id}`, "seen"), userId);
    let body: Record<string, unknown> = {};
    await page.route("**/api/recommendations/today", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
    const base = { contract: "today-v2", date: "2026-10-02", generatedAt: "now", snapshotKey: "c8000000-0000-4000-a000-000000000001", catalogVersion: "catalog", matcherVersion: "matcher", recommendationVersion: "today-ranking-v3", secondary: [] };
    const card = (availability: string, index: number, missingCount = 0, unknownCount = 0) => ({ recipeId: `c9000000-0000-4000-a000-00000000000${index}`, name: `State ${availability}`, availability, missingCount, unknownCount, quantityToCheck: availability === "quantity_to_check", missingIngredients: missingCount ? ["Tomate", "Cebolla"].slice(0, missingCount) : [], unknownIngredients: unknownCount ? ["Secreto"] : [], reasons: [{ code: availability.startsWith("missing") ? "missing" : availability === "unknown" ? "unknown" : availability === "quantity_to_check" ? "quantity_check" : "have_all" }] });
    body = { ...base, state: "ready", main: [card("ready", 1), card("quantity_to_check", 2), card("missing_one", 3, 1)] }; await page.reload(); await expect(page.getByText("Tienes todo")).toBeVisible(); await expect(page.getByText("Tienes los ingredientes")).toBeVisible(); await expect(page.getByText("Te falta 1")).toBeVisible();
    body = { ...base, state: "ready", main: [card("missing_many", 4, 2), card("unknown", 5, 0, 1)] }; await page.reload(); await expect(page.getByText("Te faltan 2")).toBeVisible(); await expect(page.getByText("Hay ingredientes por comprobar")).toBeVisible();
    for (const [state, heading] of [["empty_pantry", "Aún no sabemos qué tienes"], ["unresolved_pantry", "Revisa tu despensa"], ["no_candidates", "No encontramos una opción clara"]] as const) { body = { ...base, state, main: [] }; await page.reload(); await expect(page.getByRole("heading", { name: heading })).toBeVisible(); }
  });
});

test("R2 flag false preserves legacy home and hides v3 APIs", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E || !isLocal || process.env.PRODUCT_V3 !== "false", "requires local Supabase and PRODUCT_V3=false");
  const admin = adminClient(); await createUser(admin, page, "r2-flag-off"); await expect(page.getByRole("heading", { name: "Mi Nevera", exact: true })).toBeVisible(); expect((await page.request.get("/api/recommendations/today")).status()).toBe(404);
});
