import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseIntake } from "./purchase-intake";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

class Speech {
  static instances: Speech[] = [];
  lang = "";
  interimResults = true;
  onresult: ((event: { results: { 0: { transcript: string } }[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { Speech.instances.push(this); }
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); Speech.instances = []; });

function openVoice() {
  vi.stubGlobal("SpeechRecognition", Speech);
  render(<PurchaseIntake />);
  fireEvent.click(screen.getByRole("button", { name: "Voz" }));
  return Speech.instances[0];
}

describe("purchase dictation recovery", () => {
  it("keeps writing and explicit review available without recognition support", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    render(<PurchaseIntake />);
    fireEvent.click(screen.getByRole("button", { name: "Voz" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Este navegador no ofrece dictado");
    fireEvent.change(screen.getByLabelText("Producto reconocido"), { target: { value: "Tomates" } });
    expect(screen.getByRole("button", { name: "Revisar antes de guardar" })).toBeEnabled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["not-allowed", "permiso de este sitio"],
    ["audio-capture", "micrófono. Comprueba"],
    ["network", "servicio de dictado del navegador"],
    ["service-not-allowed", "no está disponible en español"],
    ["no-speech", "No hemos oído ninguna palabra"],
  ])("explains %s and lets the user retry without losing text", (error, message) => {
    const instance = openVoice();
    act(() => instance.onresult?.({ results: [{ 0: { transcript: "Huevos" } }] }));
    act(() => instance.onerror?.({ error }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Escuchando…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Producto reconocido")).toHaveValue("Huevos");
    fireEvent.click(screen.getByRole("button", { name: "Volver a dictar" }));
    expect(Speech.instances).toHaveLength(2);
    expect(screen.getByLabelText("Producto reconocido")).toHaveValue("Huevos");
    expect(Speech.instances[1].lang).toBe("es-ES");
  });

  it("catches synchronous microphone denial instead of breaking the page", () => {
    class DeniedSpeech extends Speech { start = vi.fn(() => { throw new DOMException("Denied", "NotAllowedError"); }); }
    vi.stubGlobal("SpeechRecognition", DeniedSpeech);
    render(<PurchaseIntake />);
    fireEvent.click(screen.getByRole("button", { name: "Voz" }));
    expect(screen.getByRole("alert")).toHaveTextContent("permiso de este sitio");
    expect(screen.queryByText("Escuchando…")).not.toBeInTheDocument();
  });

  it("stops recording while accepting its final transcript for review", () => {
    const instance = openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Detener dictado" }));
    expect(instance.stop).toHaveBeenCalled();
    expect(instance.abort).not.toHaveBeenCalled();
    act(() => instance.onresult?.({ results: [{ 0: { transcript: "Dos tomates" } }] }));
    expect(screen.getByLabelText("Producto reconocido")).toHaveValue("Dos tomates");
    expect(screen.getByRole("button", { name: "Revisar antes de guardar" })).toBeEnabled();
  });

  it("ignores late callbacks after switching to manual input", () => {
    const instance = openVoice(); const lateResult = instance.onresult; const lateError = instance.onerror;
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.change(screen.getByLabelText("Producto reconocido"), { target: { value: "Pimientos" } });
    act(() => { lateResult?.({ results: [{ 0: { transcript: "Texto atrasado" } }] }); lateError?.({ error: "network" }); });
    expect(instance.abort).toHaveBeenCalled();
    expect(screen.getByLabelText("Producto reconocido")).toHaveValue("Pimientos");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a session ending without speech and releases the mic on unmount", () => {
    const instance = openVoice(); act(() => instance.onend?.());
    expect(screen.getByRole("alert")).toHaveTextContent("No hemos oído ninguna palabra");
    fireEvent.click(screen.getByRole("button", { name: "Volver a dictar" }));
    const active = Speech.instances[1]; cleanup();
    expect(active.abort).toHaveBeenCalled();
    expect(active.onresult).toBeNull();
  });
});
