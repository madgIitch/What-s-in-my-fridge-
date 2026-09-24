const PRIVATE_DATABASES = ["neverita-inventory-v1", "neverita-features-v1", "neverita-meal-calendar", "neverita-pwa-v1"] as const;
const SESSION_KEY = "neverita:active-user";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No se pudo limpiar el almacenamiento local"));
    request.onblocked = () => reject(new Error("Cierra otras pestañas antes de cambiar de cuenta"));
  });
}

export async function establishPrivateSession(userId: string): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  const prior = window.localStorage.getItem(SESSION_KEY);
  if (prior && prior !== userId) {
    window.dispatchEvent(new CustomEvent("neverita:stop-workers"));
    await Promise.all(PRIVATE_DATABASES.map(deleteDatabase));
  }
  window.localStorage.setItem(SESSION_KEY, userId);
}

export async function clearPrivateSession(): Promise<void> {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("neverita:stop-workers"));
  if (typeof indexedDB !== "undefined") await Promise.all(PRIVATE_DATABASES.map(deleteDatabase));
  window.localStorage.removeItem(SESSION_KEY);
}

export const privateDatabaseNames = PRIVATE_DATABASES;
