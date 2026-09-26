import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("public home", () => {
  it("offers real entry points without showing sample inventory", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /Todo lo que tienes/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Espinacas")).not.toBeInTheDocument();
  });
});
