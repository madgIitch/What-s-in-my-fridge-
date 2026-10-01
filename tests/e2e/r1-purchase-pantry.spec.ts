import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const password = "r1-local-test-password";

async function createUser(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/app(?:\?|$)/);
  return email;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/app(?:\?|$)/);
}

async function stableScreenshot(page: Page, path: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => { document.getAnimations().forEach(animation => animation.finish()); document.querySelectorAll("nextjs-portal").forEach(element => element.remove()); });
  await page.waitForTimeout(300);
  await page.screenshot({ path, fullPage: true });
}

test.describe("R1 purchase intake, review and pantry", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E || process.env.PRODUCT_V3 !== "true", "requires local Supabase and PRODUCT_V3=true");

  test("purchase controls support 320px, keyboard and reduced motion", async ({ page }) => {
    await createUser(page, "r1-accessibility");
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app/add-purchase");
    const undersized = await page.locator(".purchase-methods button, .purchase-primary, .product-v3-nav > a, .product-v3-add > button").evaluateAll(elements => elements.filter(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.width < 44 || bounds.height < 44;
    }).map(element => element.textContent));
    expect(undersized).toEqual([]);
    expect(await page.locator(".product-v3-content").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Añadir", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Añadir compra", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Añadir", exact: true })).toBeFocused();
  });

  test("manual, voice fallback and unknown barcode require review and explicit confirmation", async ({ page }) => {
    await createUser(page, "r1-intake");
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/app/add-purchase");
    await expect(page.getByRole("link", { name: /Escanear ticket/ })).toBeVisible();
    await stableScreenshot(page, "../../docs/design/neverita-v3/qa/r1-add-purchase-320.png");

    const manual = page.getByRole("button", { name: "Manual" });
    await manual.click();
    await page.getByLabel("Producto reconocido").fill("Calabacín local");
    await expect(page).toHaveURL(/\/app\/add-purchase$/);
    await page.keyboard.press("Escape");
    await expect(manual).toBeFocused();

    await page.getByRole("button", { name: "Voz" }).click();
    await page.getByLabel("Producto reconocido").fill("Puerros dictados");
    await expect(page.getByText("Nada se guardará hasta que lo confirmes.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Voz" })).toBeFocused();

    await page.getByRole("button", { name: "Código de barras" }).click();
    await page.getByLabel("Código de barras").fill("999999999999999999");
    await page.getByRole("button", { name: "Revisar antes de guardar" }).click();
    await expect(page.getByText(/No conocemos este código/)).toBeVisible();
    await page.getByLabel("Nombre del producto").fill("Producto sin catálogo");
    await page.getByRole("button", { name: "Revisar antes de guardar" }).click();
    await expect(page).toHaveURL(/\/app\/add-purchase\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Solo lo dudoso" })).toBeVisible();
    await expect(page.getByText("Producto sin catálogo", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await stableScreenshot(page, "../../docs/design/neverita-v3/qa/r1-review-390.png");
    await page.getByRole("button", { name: /Confirmar 1 artículo/ }).click();
    await expect(page).toHaveURL(/\/app\/pantry$/);
    await expect(page.getByText("Producto sin catálogo")).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await expect(page.getByText(/Revisa 1 del último ticket/)).toBeVisible();
    await stableScreenshot(page, "../../docs/design/neverita-v3/qa/r1-pantry-320.png");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: /Producto sin catálogo/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Producto sin catálogo" })).toBeVisible();
    await stableScreenshot(page, "../../docs/design/neverita-v3/qa/r1-editor-390.png");
    await page.getByRole("button", { name: "Eliminar de la despensa" }).click();
    await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
    await page.goto("/app/pantry");
    await page.getByRole("link", { name: /Revisa 1 del último ticket/ }).click();
    await expect(page.getByRole("heading", { name: "Completa lo pendiente" })).toBeVisible();
    await page.getByRole("button", { name: "Omitir" }).click();
    await page.getByRole("button", { name: "Guardar decisiones" }).click();
    await expect(page).toHaveURL(/\/app\/pantry$/);
    await expect(page.getByRole("link", { name: /Revisa .*último ticket/ })).toHaveCount(0);
  });

  test("a clean mocked Vision ticket reaches R1 review and only saves after confirmation", async ({ page }) => {
    await createUser(page, "r1-ticket");
    let confirmations = 0;
    await page.route(/\/api\/ocr$/, route => route.fulfill({ json: { draftId: "unused", requestId: "vision-mock", status: "review" } }));
    await page.route("**/api/ocr/v2/drafts/*", route => route.fulfill({ status: 409, json: { message: "not normalized" } }));
    await page.route("**/api/ocr/v2/normalize", route => route.fulfill({ json: { draftId: route.request().postDataJSON().draftId, normalizerVersion: "receipt-normalizer-v2", decisions: [], lines: [{ lineId: "clean", rawName: "TOMATE PERA", rawText: "1 TOMATE PERA", displayName: "Tomate", resolution: "resolved", foodConceptId: "82000000-0000-4000-a000-000000000001", candidates: [], quantity: { precision: "unknown" }, purchase: { acquiredOn: "2026-10-01", source: "receipt" }, freshness: { precision: "estimated", windowDays: 7, source: "catalog" }, suggestedLocation: "fridge" }] } }));
    await page.route("**/api/ocr/v2/confirm", route => { confirmations += 1; return route.fulfill({ json: { draftId: route.request().postDataJSON().draftId, status: "confirmed", itemIds: ["one"], pendingCount: 0 } }); });
    await page.goto("/app/scan");
    await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: readFileSync("public/icons/icon-192.png") });
    await page.getByRole("button", { name: "Usar este recorte" }).click();
    await expect(page.getByRole("heading", { name: "Solo lo dudoso" })).toBeVisible();
    await expect(page.getByText("TOMATE PERA")).toBeVisible();
    expect(confirmations).toBe(0);
    await page.getByRole("button", { name: /Confirmar 1 artículo/ }).click();
    await expect(page).toHaveURL(/\/app\/pantry$/);
    expect(confirmations).toBe(1);
  });

  test("reviews a clean line plus three doubtful lines, correction, unknown and omission at 320px", async ({ page }) => {
    await createUser(page, "r1-review");
    await page.setViewportSize({ width: 320, height: 720 });
    const draftId = "81000000-0000-4000-a000-000000000001";
    const concepts = [
      { foodConceptId: "82000000-0000-4000-a000-000000000001", slug: "tomate", displayName: "Tomate" },
      { foodConceptId: "82000000-0000-4000-a000-000000000002", slug: "pasta", displayName: "Pasta" },
      { foodConceptId: "82000000-0000-4000-a000-000000000003", slug: "queso", displayName: "Queso" },
    ];
    const lines = [
      { lineId: "clean", rawName: "TOMATE", rawText: "TOMATE", displayName: "Tomate", resolution: "resolved", foodConceptId: concepts[0].foodConceptId, candidates: [], quantity: { precision: "unknown" }, purchase: { acquiredOn: "2026-10-01", source: "user" }, freshness: { precision: "unknown" } },
      ...["uno", "dos", "tres"].map((id, index) => ({ lineId: id, rawName: `DUDOSO ${index + 1}`, rawText: `DUDOSO ${index + 1}`, displayName: `Dudoso ${index + 1}`, resolution: "doubtful", foodConceptId: null, candidates: concepts.slice(index, index + 1), quantity: { precision: "unknown" }, purchase: { acquiredOn: "2026-10-01", source: "user" }, freshness: { precision: "unknown" } })),
    ];
    let confirmed: Record<string, unknown> | undefined;
    await page.route(`**/api/ocr/v2/drafts/${draftId}`, async route => route.request().method() === "GET"
      ? route.fulfill({ status: 409, json: { message: "not normalized" } })
      : route.fulfill({ json: { decisions: route.request().postDataJSON().decisions } }));
    await page.route("**/api/ocr/v2/normalize", route => route.fulfill({ json: { draftId, normalizerVersion: "receipt-normalizer-v2", lines, decisions: [] } }));
    await page.route("**/api/ocr/v2/confirm", route => { confirmed = route.request().postDataJSON(); return route.fulfill({ json: { draftId, status: "confirmed", itemIds: ["a", "b", "c"], pendingCount: 1 } }); });
    await page.goto(`/app/add-purchase/${draftId}`);
    await expect(page.getByText("DUDOSO 3")).toBeVisible();
    await page.getByRole("group", { name: "Dudoso" }).nth(0).getByRole("button", { name: "Tomate" }).click();
    await page.getByRole("group", { name: "Dudoso" }).nth(1).getByRole("button", { name: "Mantener como desconocido" }).click();
    await page.getByRole("group", { name: "Dudoso" }).nth(2).getByRole("button", { name: "Omitir" }).click();
    await page.getByRole("button", { name: /Confirmar 3 artículos/ }).click();
    await expect(page).toHaveURL(/\/app\/pantry$/);
    expect((confirmed?.lines as { decision: string }[]).map(line => line.decision)).toEqual(["accept", "accept", "unknown", "omit"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("offline edit survives reload, reconnects once, and another user cannot see it", async ({ page, context, browser }) => {
    test.setTimeout(90_000);
    const email = await createUser(page, "r1-offline");
    await page.goto("/app/add-purchase");
    await page.getByRole("button", { name: "Manual" }).click();
    await page.getByLabel("Producto reconocido").fill("Berenjena offline");
    await page.getByRole("button", { name: "Revisar antes de guardar" }).click();
    await page.getByRole("button", { name: /Confirmar 1 artículo/ }).click();
    await expect(page.getByText("Berenjena offline")).toBeVisible();
    await page.getByRole("link", { name: /Berenjena offline/ }).click();
    await expect(page.getByRole("heading", { name: "Berenjena offline" })).toBeVisible();
    const editorUrl = page.url();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Poco" }).click();
    await page.getByLabel("Nota").fill("editada sin conexión");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambio pendiente de guardar.")).toBeVisible();
    await page.getByRole("link", { name: /Despensa/ }).first().click();
    await expect(page.getByRole("heading", { name: "Inventario local" })).toBeVisible();
    await expect(page.getByText("Berenjena offline")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inventario local" })).toBeVisible();
    await expect(page.getByText("Berenjena offline")).toBeVisible();
    const cached = await page.evaluate(async () => { const opened = indexedDB.open("neverita-inventory-v1"); const db = await new Promise<IDBDatabase>((resolve, reject) => { opened.onsuccess = () => resolve(opened.result); opened.onerror = () => reject(opened.error); }); const request = db.transaction("items").objectStore("items").getAll(); return await new Promise<{ stockState?: string; notes?: string }[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); });
    expect(cached).toContainEqual(expect.objectContaining({ stockState: "low", notes: "editada sin conexión" }));
    await context.setOffline(false);
    await page.goto(editorUrl);
    await expect(page.getByLabel("Nota")).toHaveValue("editada sin conexión");
    await expect.poll(() => page.evaluate(async () => { const opened = indexedDB.open("neverita-inventory-v1"); const db = await new Promise<IDBDatabase>((resolve, reject) => { opened.onsuccess = () => resolve(opened.result); opened.onerror = () => reject(opened.error); }); const request = db.transaction("outbox").objectStore("outbox").count(); return await new Promise<number>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); })).toBe(0);

    const other: BrowserContext = await browser.newContext();
    const otherPage = await other.newPage();
    await createUser(otherPage, "r1-other");
    await otherPage.goto("/app/pantry");
    await expect(otherPage.getByText("Berenjena offline")).toHaveCount(0);
    await other.close();

    const sameAccount = await browser.newContext();
    const samePage = await sameAccount.newPage();
    await login(samePage, email);
    await samePage.goto("/app/pantry");
    await expect(samePage.getByText("Berenjena offline")).toBeVisible();
    await sameAccount.close();
  });

  test("two sessions preserve both values on a version conflict", async ({ page, context, browser }) => {
    test.setTimeout(90_000);
    await createUser(page, "r1-conflict");
    await page.goto("/app/add-purchase");
    await page.getByRole("button", { name: "Manual" }).click();
    await page.getByLabel("Producto reconocido").fill("Calabaza concurrente");
    await page.getByRole("button", { name: "Revisar antes de guardar" }).click();
    await page.getByRole("button", { name: /Confirmar 1 artículo/ }).click();
    await expect(page.getByText("Calabaza concurrente")).toBeVisible();
    const itemHref = await page.getByRole("link", { name: /Calabaza concurrente/ }).getAttribute("href");
    expect(itemHref).toBeTruthy();

    const peer = await browser.newContext({ storageState: await context.storageState() });
    const peerPage = await peer.newPage();
    await Promise.all([page.goto(itemHref!), peerPage.goto(itemHref!)]);
    await expect(page.getByLabel("Nota")).toBeVisible();
    await expect(peerPage.getByLabel("Nota")).toBeVisible();

    await page.getByLabel("Nota").fill("valor del primer dispositivo");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(() => page.evaluate(async () => { const opened = indexedDB.open("neverita-inventory-v1"); const db = await new Promise<IDBDatabase>((resolve, reject) => { opened.onsuccess = () => resolve(opened.result); opened.onerror = () => reject(opened.error); }); const request = db.transaction("outbox").objectStore("outbox").getAll(); const rows = await new Promise<{ state: string; lastError: string | null }[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); return rows.length ? `${rows[0].state}:${rows[0].lastError}` : "empty"; }), { timeout: 15_000 }).toBe("empty");

    await peerPage.getByLabel("Nota").fill("valor del segundo dispositivo");
    await peerPage.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(peerPage.getByRole("heading", { name: "Hay dos versiones" })).toBeVisible();
    await expect(peerPage.getByText(/En otro dispositivo/)).toContainText("Calabaza concurrente");
    await expect(peerPage.getByRole("button", { name: "Usar la otra versión" })).toBeVisible();
    await expect(peerPage.getByRole("button", { name: "Reintentar con mi cambio" })).toBeVisible();
    await peer.close();
  });
});

test("R1 disabled preserves the legacy scan and pantry routes", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E || process.env.PRODUCT_V3 !== "false", "requires local Supabase and PRODUCT_V3=false");
  await createUser(page, "r1-legacy");
  await page.goto("/app/add-purchase");
  await expect(page).toHaveURL(/\/app\/scan$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
  await page.goto("/app/pantry");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Mi Nevera", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Revisa .*último ticket/ })).toHaveCount(0);
});
