import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => process.platform === "win32" && browserName === "firefox", "Firefox Playwright process fails to launch on this Windows host; run browser PWA cases on Linux CI.");

test("manifest and service worker expose only the public shell", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  expect(await manifest.json()).toMatchObject({ start_url: "/app", display: "standalone" });
  const worker = await request.get("/sw.js");
  expect(await worker.text()).toContain('url.pathname.startsWith("/api/")');
});

test("first offline navigation has a recoverable non-authoritative shell", async ({ page, context, browserName }) => {
  test.skip(process.platform === "win32" && browserName === "webkit", "Windows Playwright WebKit cannot reliably intercept offline navigation; Chromium covers this navigation fallback here.");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto("/app").catch(() => undefined);
  await expect(page.getByRole("status")).toContainText(/Sin conexión|local/i);
});

test("offline shell shows only the active user's materialized inventory", async ({ page, context, browserName }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.setItem("neverita:active-user", "active-user");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("neverita-inventory-v1", 1);
      request.onupgradeneeded = () => {
        const items = request.result.createObjectStore("items", { keyPath: "key" });
        items.createIndex("by_user", "userId");
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("items", "readwrite");
        transaction.objectStore("items").put({ key: "active-user:one", userId: "active-user", name: "Tomate", quantity: 2, unit: "unidad", syncState: "pending", updatedAt: new Date().toISOString(), deletedAt: null });
        transaction.objectStore("items").put({ key: "other-user:one", userId: "other-user", name: "Secreto", quantity: 1, unit: "unidad", syncState: "synced", updatedAt: new Date().toISOString(), deletedAt: null });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  if (process.platform === "win32" && browserName === "webkit") {
    await page.goto("/offline.html");
    await context.setOffline(true);
  } else {
    await context.setOffline(true);
    await page.goto("/app").catch(() => undefined);
  }
  await expect(page.getByText("Tomate")).toBeVisible();
  await expect(page.getByText("Secreto")).toHaveCount(0);
  await expect(page.getByText(/Pendiente o requiere revisión/)).toBeVisible();
});
