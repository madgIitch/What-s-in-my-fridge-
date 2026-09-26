import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ReceiptScanner } from "./receipt-scanner";

describe("receipt crop keyboard behavior", () => {
  it("shows a clear route home after confirming a recovered ticket", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => new Response(JSON.stringify(
      String(input).endsWith("/confirm")
        ? { status: "confirmed", itemIds: ["item-1"] }
        : { draftId: "draft-1", draft: { merchant: "MERCADO", purchaseDate: null, currency: "EUR", total: null, items: [{ lineId: "line-2", rawText: "1 COUS COUS", name: "COUS COUS", quantity: "1", unit: "unit", unitPrice: null, totalPrice: "1.95", confidence: 0.9, accepted: true }], unrecognizedLines: [] } },
    ), { status: 200 }));
    try {
      render(<ReceiptScanner />);
      fireEvent.click(screen.getByRole("button", { name: /Retomar última revisión/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Confirmar artículos" }));
      expect(await screen.findByRole("heading", { name: "Compra añadida" })).toHaveFocus();
      expect(screen.getByRole("link", { name: "Volver a Mi Nevera" })).toHaveAttribute("href", "/app");
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    } finally { request.mockRestore(); scrollTo.mockRestore(); }
  });

  it("resumes a saved ticket without requesting another scan", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      draftId: "draft-1",
      draft: { merchant: "MERCADO", purchaseDate: null, currency: "EUR", total: null, items: [{ lineId: "line-2", rawText: "1 COUS COUS\n1,95", name: "COUS COUS", quantity: "1", unit: "unit", unitPrice: null, totalPrice: "1.95", confidence: 0.75, accepted: true }], unrecognizedLines: [] },
    }), { status: 200 }));
    try {
      render(<ReceiptScanner />);
      fireEvent.click(screen.getByRole("button", { name: /Retomar última revisión/ }));
      expect(await screen.findByRole("heading", { name: "Revisa cada línea" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/sin consumir otra lectura OCR/);
      expect(screen.getByLabelText("Nombre")).toHaveValue("COUS COUS");
      expect(request).toHaveBeenCalledWith("/api/ocr/recover", { cache: "no-store" });
    } finally { request.mockRestore(); }
  });

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
