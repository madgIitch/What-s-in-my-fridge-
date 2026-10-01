import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  user: { id: "owner" } as { id: string } | null,
}));
vi.mock("@/lib/inventory/db", () => ({ listOutbox: async () => [] }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({ auth: {
    getUser: async () => ({ data: { user: auth.user } }),
    onAuthStateChange: (callback: typeof auth.callback) => {
      auth.callback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  } }),
}));
import { TodayApp } from "./today-app";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); auth.user = { id: "owner" }; auth.callback = null; });

it("does not restore a private shopping dialog when a pending request fails after logout", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  let rejectShopping: (reason: Error) => void = () => {};
  const shoppingRequest = new Promise<Response>((_resolve, reject) => { rejectShopping = reject; });
  const fetchMock = vi.fn((url: string) => url.endsWith("/shopping") ? shoppingRequest : Promise.resolve(Response.json({
    contract: "today-v2", date: "2026-10-02", generatedAt: new Date().toISOString(), state: "ready",
    snapshotKey: "snapshot", catalogVersion: "catalog", matcherVersion: "test", recommendationVersion: "test",
    main: [{ recipeId: "recipe", name: "Cena de prueba", availability: "missing_one", missingCount: 1,
      unknownCount: 0, quantityToCheck: false, missingIngredients: ["Cebolla"], unknownIngredients: [], reasons: [{ code: "missing" }] }], secondary: [],
  })));
  vi.stubGlobal("fetch", fetchMock);
  render(<TodayApp userId="owner" />);
  fireEvent.click(await screen.findByRole("button", { name: "Añadir a la compra" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar y añadir" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Añadiendo…" })).toBeDisabled());
  act(() => { auth.user = null; auth.callback?.("SIGNED_OUT", null); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Cena de prueba")).not.toBeInTheDocument();
  await act(async () => { rejectShopping(new Error("network lost")); await Promise.resolve(); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Cena de prueba")).not.toBeInTheDocument();
});
