/* Public shell logic. Reads only the active user's IndexedDB partition. */
(async () => {
  document.getElementById("retry").addEventListener("click", () => location.reload());
  const status = document.querySelector('[role="status"]');
  const userId = localStorage.getItem("neverita:active-user");
  if (!userId || !("indexedDB" in window)) {
    status.textContent = "Sin conexión y todavía no hay una copia local disponible.";
    return;
  }
  try {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("neverita-inventory-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!database.objectStoreNames.contains("items")) {
      database.close();
      status.textContent = "Sin conexión y todavía no hay una copia local disponible.";
      return;
    }
    const rows = await new Promise((resolve, reject) => {
      const request = database.transaction("items", "readonly").objectStore("items").index("by_user").getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    const items = rows.filter((row) => !row.deletedAt);
    if (!items.length) {
      status.textContent = "Sin conexión. No hay alimentos guardados para esta cuenta.";
      return;
    }
    document.querySelector("section").hidden = false;
    const list = document.getElementById("items");
    for (const item of items) {
      const li = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const details = document.createElement("span");
      details.textContent = ` · ${item.quantity} ${item.unit} · ${item.syncState === "synced" ? "Copia local" : "Pendiente o requiere revisión"}`;
      li.append(name, details);
      list.append(li);
    }
    const latest = items.map((item) => Date.parse(item.updatedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    document.getElementById("cache-age").textContent = latest ? `Último dato guardado: ${new Date(latest).toLocaleString("es-ES")}. Los datos pueden estar desactualizados.` : "Los datos pueden estar desactualizados.";
    status.textContent = "Sin conexión. Mostrando una copia local; los cambios pendientes no están confirmados.";
  } catch {
    status.textContent = "Sin conexión. No se pudo leer la copia local. Reintenta cuando vuelva la conexión.";
  }
})();
