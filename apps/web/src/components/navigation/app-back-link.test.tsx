import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppBackLink } from "./app-back-link";

const navigation = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("AppBackLink", () => {
  it("keeps the inventory free of a navigation bar", () => {
    navigation.pathname = "/app";
    render(<AppBackLink />);
    expect(screen.queryByRole("link", { name: /Mi Nevera/ })).not.toBeInTheDocument();
  });

  it("provides a return path from secondary screens", () => {
    navigation.pathname = "/app/recipes";
    render(<AppBackLink />);
    expect(screen.getByRole("link", { name: /Mi Nevera/ })).toHaveAttribute("href", "/app");
  });
});
