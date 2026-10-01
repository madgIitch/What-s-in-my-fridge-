import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductV3Nav } from "./product-v3-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/pantry" }));

describe("product v3 navigation", () => {
  it("shows exactly the five approved mobile destinations", () => {
    render(<ProductV3Nav />);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav.querySelectorAll(":scope > a, :scope > div.product-v3-add")).toHaveLength(5);
    for (const label of ["Hoy", "Despensa", "Cocinar", "Compra"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Calendar|Favoritos/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Despensa" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the central add choices", () => {
    render(<ProductV3Nav />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(screen.getByRole("link", { name: "Añadir compra" })).toHaveAttribute("href", "/app/add-purchase");
    expect(screen.getByRole("link", { name: "Escanear ticket" })).toHaveAttribute("href", "/app/scan");
    expect(screen.getByRole("link", { name: "Código de barras" })).toHaveAttribute("href", "/app/add-purchase");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Escanear ticket" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir" })).toHaveFocus();
  });
});
