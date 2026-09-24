/* Neverita public shell service worker. Private application data belongs in user-partitioned IndexedDB. */
const CACHE_PREFIX = "neverita-shell-";
const CACHE_VERSION = "v2";
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const PUBLIC_SHELL = [
  "/manifest.webmanifest",
  "/offline.html",
  "/offline.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

function hasSensitiveRequestHeaders(request) {
  return request.headers.has("authorization");
}

function isPublicAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return false;
  if (request.mode === "navigate" || request.destination === "document") return false;
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/offline.js";
}

function canStore(request, response) {
  return request.method === "GET" && !hasSensitiveRequestHeaders(request) && isPublicAsset(request) && response.ok && !response.headers.has("set-cookie") && response.type !== "opaque";
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PUBLIC_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || hasSensitiveRequestHeaders(request) || new URL(request.url).pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("Sin conexión", { status: 503 })));
    return;
  }
  if (!isPublicAsset(request)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (canStore(request, response)) void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

function safeNotificationPath(value) {
  if (typeof value !== "string" || !value.startsWith("/app") || value.startsWith("//") || value.length > 512 || /[%\\\u0000-\u001f]/.test(value)) return null;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (/(?:^|\/)\.\.(?:\/|$)/.test(decoded) || decoded.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;
  const parsed = new URL(value, self.location.origin);
  if (parsed.origin !== self.location.origin || parsed.hash) return null;
  const normalized = `${parsed.pathname}${parsed.search}`;
  return /^\/app$/.test(normalized) || /^\/app\/recipes$/.test(normalized) || /^\/app\/recipes\/import(?:\?job=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/.test(normalized) ? normalized : null;
}

self.addEventListener("push", (event) => {
  let payload = null;
  try { payload = event.data?.json(); } catch { return; }
  const path = safeNotificationPath(payload?.path);
  if (payload?.version !== "push-v1" || payload?.type !== "recipe-job-completed" || typeof payload?.eventId !== "string" || !path) return;
  event.waitUntil(self.registration.showNotification("Tu receta está lista", { body: "Abre Neverita para consultar el resultado.", tag: payload.eventId, data: { path } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safeNotificationPath(event.notification.data?.path);
  if (!path) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(path); return existing.focus(); }
    return self.clients.openWindow(path);
  }));
});
