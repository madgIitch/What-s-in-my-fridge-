import test from "node:test";
import assert from "node:assert/strict";
import { OllamaRecipeProvider, providerTimeout } from "./providers.js";

test("Ollama adapter calls generate endpoint with a non-streaming JSON prompt", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: JSON.stringify({ schemaVersion: "recipe-v1", title: "Tortilla", ingredients: [{ name: "huevo" }], steps: ["Batir"], source: { type: "manual" }, provenance: {} }) }), { status: 200 });
  };
  try {
    const result = await new OllamaRecipeProvider("https://ollama.example/").extract("Dos huevos y sal", { sourceType: "manual" });
    assert.equal(requestUrl, "https://ollama.example/api/generate");
    assert.equal(requestBody.model, "qwen2.5:3b");
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.format, "json");
    assert.match(String(requestBody.prompt), /Dos huevos y sal/);
    assert.equal((result as { title: string }).title, "Tortilla");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider timeouts allow Ollama cold starts without changing Whisper", () => {
  assert.equal(providerTimeout("OLLAMA"), 300_000);
  assert.equal(providerTimeout("WHISPER"), 120_000);
});
