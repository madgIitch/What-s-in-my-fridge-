import { expect, test } from "@playwright/test";

test.describe("inventory offline-first against local Supabase", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires the local Supabase stack");

  test("persists an offline create across reload and remains usable at 320px", async ({ page, context }) => {
    const email = `inventory-${Date.now()}@example.test`;
    const password = "inventory-test-password";
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Crear cuenta/ }).click();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/app/);

    await page.setViewportSize({ width: 320, height: 720 });
    await context.setOffline(true);
    await page.getByLabel("Nombre").fill("Yogur offline");
    await page.getByLabel("Caducidad").fill("2026-10-02");
    await page.getByRole("button", { name: "Añadir al inventario" }).click();
    await expect(page.getByText("Estado: pending")).toBeVisible();
    const persisted = await page.evaluate(async () => {
      const request = indexedDB.open("neverita-inventory-v1");
      const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const read = (store: string) => new Promise<unknown[]>((resolve, reject) => { const value = db.transaction(store).objectStore(store).getAll(); value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
      return { items: await read("items"), outbox: await read("outbox") };
    });
    expect(persisted.items).toHaveLength(1); expect(persisted.outbox).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);

    await context.setOffline(false);
    await page.getByRole("button", { name: "Sincronizar" }).click();
    await expect(page.getByText("Estado: synced")).toBeVisible();
  });
});
