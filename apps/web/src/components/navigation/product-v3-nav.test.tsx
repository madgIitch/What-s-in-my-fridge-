import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductV3Nav } from "./product-v3-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/pantry" }));

describe("product v3 navigation", () => {
  it("shows exactly the five approved mobile destinations", () => {
    render(<ProductV3Nav />);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav.querySelectorAll(":scope > a, :scope > div.product-v3-add")).toHaveLength(5);
    for (const label of ["Hoy", "Despensa", "Cocinar", "Compra"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Añadir compra" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Calendar|Favoritos/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Despensa" })).toHaveAttribute("aria-current", "page");
  });

  it("links directly to purchase intake without duplicate choices", () => {
    render(<ProductV3Nav />);
    expect(screen.getByRole("link", { name: "Añadir compra" })).toHaveAttribute("href", "/app/add-purchase");
    expect(screen.queryByRole("link", { name: "Escanear ticket" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Código de barras" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Añadir compra" })).not.toHaveAttribute("aria-expanded");
  });
});
