import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ReceiptScanner } from "./receipt-scanner";

describe("receipt crop keyboard behavior", () => {
  it("lets Escape cancel crop and restores focus to the file action", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      const { container } = render(<ReceiptScanner />);
      const input = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(["image"], "ticket.png", { type: "image/png" })] } });
      expect(await screen.findByRole("heading", { name: "Recorta el ticket" })).toHaveFocus();
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(screen.getByRole("button", { name: "Seleccionar archivo" })).toHaveFocus());
      expect(screen.getByRole("heading", { name: "Escanea tu compra" })).toBeInTheDocument();
    } finally { create.mockRestore(); revoke.mockRestore(); }
  });
});
