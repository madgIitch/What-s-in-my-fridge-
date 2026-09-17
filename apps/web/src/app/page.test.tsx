import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("migration shell", () => {
  it("renders the inventory workspace in Spanish", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /Buenos días/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Navegación principal/ })).toBeInTheDocument();
    expect(screen.getByText("Espinacas")).toBeInTheDocument();
  });
});
