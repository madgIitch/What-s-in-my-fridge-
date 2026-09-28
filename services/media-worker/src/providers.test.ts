import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OllamaRecipeProvider, WhisperProvider, providerTimeout } from "./providers.js";

test("Whisper uploads the processed audio to /transcribe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "neverita-provider-test-"));
  const audio = join(dir, "audio.mp3");
  await writeFile(audio, Buffer.from("ID3test-audio"));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
  process.env.INTERNAL_SERVICE_TOKEN = "test-token";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://whisper.example/transcribe");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-token");
    const body = init?.body as FormData;
    assert.equal((body.get("audio") as File).name, "audio.mp3");
    assert.equal(Buffer.from(await (body.get("audio") as File).arrayBuffer()).toString(), "ID3test-audio");
    return new Response(JSON.stringify({ text: "Tomate y aceite", language: "es" }), { status: 200 });
  };
  try {
    const result = await new WhisperProvider("https://whisper.example/").transcribe(audio);
    assert.equal(result.text, "Tomate y aceite");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.INTERNAL_SERVICE_TOKEN;
    else process.env.INTERNAL_SERVICE_TOKEN = originalToken;
    await rm(dir, { recursive: true, force: true });
  }
});

test("Whisper classifies authentication and rate limit failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "neverita-provider-test-"));
  const audio = join(dir, "audio.mp3");
  await writeFile(audio, Buffer.from("ID3test-audio"));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
  process.env.INTERNAL_SERVICE_TOKEN = "test-token";
  try {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(new WhisperProvider("https://whisper.example").transcribe(audio), { code: "WHISPER_AUTH_FAILED" });
    globalThis.fetch = async () => new Response(null, { status: 429 });
    await assert.rejects(new WhisperProvider("https://whisper.example").transcribe(audio), { code: "WHISPER_RATE_LIMITED" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.INTERNAL_SERVICE_TOKEN;
    else process.env.INTERNAL_SERVICE_TOKEN = originalToken;
    await rm(dir, { recursive: true, force: true });
  }
});

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

test("provider timeouts allow cold starts for both services", () => {
  assert.equal(providerTimeout("OLLAMA"), 300_000);
  assert.equal(providerTimeout("WHISPER"), 300_000);
});

test("quality extraction constrains the schema and deterministic generation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.format.type, "object");
    assert.deepEqual(body.options, { temperature: 0, seed: 42, num_predict: 4096 });
    assert.match(body.prompt, /evidenceIds/);
    assert.match(body.prompt, /omite amount y unit/);
    return Response.json({ response: JSON.stringify({ title: "Tortilla", ingredients: [{ name: "Huevos", evidenceIds: ["s"] }], steps: [{ text: "Batir los huevos", evidenceIds: ["s"] }] }) });
  };
  try {
    const result = await new OllamaRecipeProvider("https://ollama.example").extract("2 huevos", { sourceType: "manual", evidence: [{ id: "s", kind: "manual", text: "2 huevos. Batir los huevos." }] });
    assert.equal((result as { title: string }).title, "Tortilla");
  } finally { globalThis.fetch = originalFetch; }
});
