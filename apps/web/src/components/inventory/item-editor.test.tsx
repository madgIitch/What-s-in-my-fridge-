import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ItemEditor } from "./item-editor";

const fixtures = vi.hoisted(() => ({
  getItem: vi.fn(), putItems: vi.fn(), maybeSingle: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixtures.push, refresh: fixtures.refresh }) }));
vi.mock("@/lib/inventory/db", () => ({ getItem: fixtures.getItem, putItems: fixtures.putItems }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: fixtures.maybeSingle }) }) }) }) }));
vi.mock("@/lib/inventory/sync", () => ({ syncInventory: vi.fn() }));

describe("ItemEditor deep links", () => {
  it("loads a remote item when the local device has no cache", async () => {
    fixtures.getItem.mockResolvedValue(undefined);
    fixtures.putItems.mockResolvedValue(undefined);
    fixtures.maybeSingle.mockResolvedValue({ data: {
      id: "11111111-1111-4111-8111-111111111111", user_id: "owner", name: "Leche", normalized_name: "leche",
      expiry_date: "2026-09-28", category: null, quantity: 2, notes: null, unit: "l", added_at: "2026-09-25T00:00:00Z",
      created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z", deleted_at: null, version: 1,
    }, error: null });
    render(<ItemEditor userId="owner" itemId="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Leche");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(fixtures.putItems).toHaveBeenCalledOnce();
  });

  it("shows a useful missing state for unavailable detail links", async () => {
    fixtures.getItem.mockResolvedValue(undefined);
    fixtures.maybeSingle.mockResolvedValue({ data: null, error: null });
    render(<ItemEditor userId="owner" itemId="22222222-2222-4222-8222-222222222222" />);
    expect(await screen.findByRole("heading", { name: "Alimento no encontrado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver inventario" })).toHaveAttribute("href", "/app");
  });

  it("requires a valid quantity and explicit confirmation before consuming", async () => {
    fixtures.getItem.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333", userId: "owner", name: "Leche", expiryDate: "2026-09-28",
      quantity: 2, unit: "l", category: null, notes: null, syncState: "synced", deletedAt: null,
    });
    render(<ItemEditor userId="owner" itemId="33333333-3333-4333-8333-333333333333" />);
    const quantity = await screen.findByRole("spinbutton", { name: "Cantidad a consumir" });
    fireEvent.change(quantity, { target: { value: "3" } });
    expect(screen.getByRole("button", { name: "Revisar consumo" })).toBeDisabled();
    fireEvent.change(quantity, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar consumo" }));
    expect(screen.getByText("Se descontarán 1 l de Leche.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar consumo" })).toBeInTheDocument();
  });

  it("returns focus to delete after Escape closes its confirmation", async () => {
    fixtures.getItem.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444", userId: "owner", name: "Leche", expiryDate: "2026-09-28",
      quantity: 2, unit: "l", category: null, notes: null, syncState: "synced", deletedAt: null,
    });
    render(<ItemEditor userId="owner" itemId="44444444-4444-4444-8444-444444444444" />);
    const trigger = await screen.findByRole("button", { name: "Eliminar" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "¿Eliminar Leche?" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "¿Eliminar Leche?" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
