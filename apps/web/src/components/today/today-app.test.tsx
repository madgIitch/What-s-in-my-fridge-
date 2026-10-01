import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), listOutbox: vi.fn(), unsubscribe: vi.fn(), authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("@/lib/inventory/db", () => ({ listOutbox: mocks.listOutbox }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ auth: {
  getUser: mocks.getUser,
  onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; },
} }) }));

import { TodayApp } from "./today-app";

const user = { id: "user-one" };
const missingResponse = {
  contract: "today-v2", date: "2026-10-02", generatedAt: "2026-10-02T10:00:00Z", state: "ready",
  snapshotKey: "98000000-0000-4000-a000-000000000001", catalogVersion: "catalog", matcherVersion: "matcher", recommendationVersion: "today-ranking-v3",
  main: [{ recipeId: "99000000-0000-4000-a000-000000000001", name: "Tortilla", availability: "missing_one", missingCount: 1, unknownCount: 0, quantityToCheck: false, missingIngredients: ["Cebolla"], unknownIngredients: [], reasons: [{ code: "missing" }] }], secondary: [],
};
const emptyResponse = { ...missingResponse, state: "empty_pantry", main: [] };

beforeEach(() => {
  vi.clearAllMocks(); mocks.authChange = null; localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  mocks.getUser.mockResolvedValue({ data: { user } }); mocks.listOutbox.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(missingResponse), { status: 200, headers: { "Content-Type": "application/json" } })));
});

describe("Today browser lifecycle", () => {
  it("keeps the same mutation after a lost response and offers refresh after a snapshot conflict", async () => {
    const request = vi.mocked(fetch);
    request.mockImplementation(async (url) => String(url).endsWith("/shopping")
      ? Response.json({ code: "SNAPSHOT_CONFLICT" }, { status: 409 })
      : Response.json(missingResponse));
    render(<TodayApp userId={user.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir a la compra" }));
    request.mockRejectedValueOnce(new Error("lost response"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y añadir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await screen.findByRole("button", { name: "Actualizar Hoy" });
    const shoppingCalls = request.mock.calls.filter(([url]) => String(url).endsWith("/shopping"));
    expect(shoppingCalls).toHaveLength(2);
    expect(shoppingCalls[0][1]?.body).toBe(shoppingCalls[1][1]?.body);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Hoy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(request.mock.calls.filter(([url]) => String(url).endsWith("/today"))).toHaveLength(2));
  });

  it("loads once, emits TTMD only after a visible decision, and clears private data on logout", async () => {
    const metrics: Record<string, unknown>[] = []; const listener = (event: Event) => metrics.push((event as CustomEvent).detail);
    window.addEventListener("neverita:today-metric", listener);
    render(<StrictMode><TodayApp userId={user.id} /></StrictMode>);
    expect(await screen.findByRole("heading", { name: "Tortilla" })).toBeVisible();
    await waitFor(() => expect(metrics.map((item) => item.phase)).toEqual(["opened", "decision_visible"]));
    expect(metrics[1]).toEqual(expect.objectContaining({ outcome: "proposal" }));
    expect(metrics.some((item) => "userId" in item || "recipeId" in item || "snapshotKey" in item)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    mocks.authChange?.("SIGNED_OUT", null);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Tortilla" })).not.toBeInTheDocument());
    window.removeEventListener("neverita:today-metric", listener);
  });

  it("traps and restores modal focus, and disables confirmation when connectivity is lost", async () => {
    render(<TodayApp userId={user.id} />); const trigger = await screen.findByRole("button", { name: "Añadir a la compra" }); trigger.focus(); fireEvent.click(trigger);
    const cancel = await screen.findByRole("button", { name: "Cancelar" }); await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" }); await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger); await screen.findByRole("button", { name: "Confirmar y añadir" });
    fireEvent(window, new Event("offline"));
    expect(await screen.findByText("Resultado anterior · Sin conexión")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar y añadir" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("degrades when storage is unavailable and keeps the demo isolated", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse), { status: 200, headers: { "Content-Type": "application/json" } }));
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<TodayApp userId={user.id} />);
    expect(await screen.findByRole("heading", { name: /Sabe lo que tienes/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver un ejemplo primero" }));
    expect(await screen.findByText(/Sus acciones están desactivadas/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Cocinar esto/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Cocinar esto/ })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1); getItem.mockRestore();
  });
});
