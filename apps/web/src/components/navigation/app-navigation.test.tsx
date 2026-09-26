import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppNavigation } from "./app-navigation";

const navigation = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("AppNavigation", () => {
  it("exposes five keyboard reachable destinations and marks the current page", () => {
    navigation.pathname = "/app/calendar";
    render(<AppNavigation />);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(nav.querySelectorAll("a[href^='/app']")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Comidas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inventario" })).not.toHaveAttribute("aria-current");
  });

  it("keeps secondary destinations under More", () => {
    navigation.pathname = "/app/favorites";
    render(<AppNavigation />);
    expect(screen.getByRole("link", { name: "Más" })).toHaveAttribute("aria-current", "page");
  });

  it("marks inventory active on its editor routes", () => {
    navigation.pathname = "/app/items/new";
    render(<AppNavigation />);
    expect(screen.getByRole("link", { name: "Inventario" })).toHaveAttribute("aria-current", "page");
  });
});
