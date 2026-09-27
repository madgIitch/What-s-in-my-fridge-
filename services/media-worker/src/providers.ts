import { readFile, stat } from "node:fs/promises";
import type { RecipeExtractionProvider, SourceType, TranscriptionProvider } from "./contracts.js";
import { WorkerError } from "./worker-error.js";

type ProviderName = "OLLAMA" | "WHISPER";

export function providerTimeout(provider: ProviderName) {
  const fallback = 300_000;
  const configured = Number(process.env[`${provider}_PROVIDER_TIMEOUT_MS`] ?? fallback);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 600_000 ? configured : fallback;
}

async function providerFetch(provider: ProviderName, url: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(providerTimeout(provider)),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    throw new WorkerError(`${provider}_${timeout ? "TIMEOUT" : "UNAVAILABLE"}`);
  }
  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500;
    throw new WorkerError(`${provider}_${transient ? "UNAVAILABLE" : "REJECTED"}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function endpoint(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

export class WhisperProvider implements TranscriptionProvider {
  constructor(private endpoint: string) {}
  async transcribe(audioPath: string) {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token) throw new WorkerError("WHISPER_AUTH_FAILED");
    const size = (await stat(audioPath)).size;
    if (size === 0) throw new WorkerError("WHISPER_AUDIO_INVALID");
    if (size > 20 * 1024 * 1024) throw new WorkerError("WHISPER_AUDIO_TOO_LARGE");
    const form = new FormData();
    form.set("audio", new Blob([await readFile(audioPath)], { type: "audio/mpeg" }), "audio.mp3");
    let response: Response;
    try {
      response = await fetch(endpoint(this.endpoint, "/transcribe"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(providerTimeout("WHISPER")),
      });
    } catch (error) {
      throw new WorkerError(error instanceof Error && error.name === "TimeoutError" ? "WHISPER_TIMEOUT" : "WHISPER_UNAVAILABLE");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new WorkerError("WHISPER_AUTH_FAILED");
      if (response.status === 413) throw new WorkerError("WHISPER_AUDIO_TOO_LARGE");
      if (response.status === 400 || response.status === 415 || response.status === 422) throw new WorkerError("WHISPER_AUDIO_INVALID");
      if (response.status === 429) throw new WorkerError("WHISPER_RATE_LIMITED");
      throw new WorkerError(response.status >= 500 ? "WHISPER_UNAVAILABLE" : "WHISPER_REJECTED");
    }
    const result = await response.json() as Record<string, unknown>;
    if (typeof result.text !== "string") throw new Error("TRANSCRIPTION_INVALID");
    return { text: result.text, provider: "whisper-service" };
  }
}

export class OllamaRecipeProvider implements RecipeExtractionProvider {
  constructor(private baseUrl: string) {}

  async extract(text: string, context: { sourceType: SourceType; sourceUrl?: string; repair?: boolean }) {
    const prompt = [
      "Devuelve exclusivamente JSON válido para una receta.",
      'Contrato: {"schemaVersion":"recipe-v1","title":"...","ingredients":[{"name":"...","amount":"...","unit":"..."}],"steps":["..."],"source":{"type":"manual"},"provenance":{}}.',
      "No uses Markdown ni texto fuera del JSON.",
      context.repair ? "Repara cualquier incumplimiento del contrato." : "Extrae solo datos presentes en el texto.",
      `Contexto: ${JSON.stringify(context)}`,
      `Texto:\n${text}`,
    ].join("\n\n");
    const result = await providerFetch("OLLAMA", endpoint(this.baseUrl, "/api/generate"), {
      model: process.env.OLLAMA_RECIPE_MODEL ?? "qwen2.5:3b",
      prompt,
      format: "json",
      stream: false,
    });
    if (typeof result.response !== "string") throw new WorkerError("OLLAMA_INVALID_RESPONSE");
    try {
      const parsed = JSON.parse(result.response) as Record<string, unknown>;
      return parsed.recipe ?? parsed;
    } catch {
      throw new Error("RECIPE_SCHEMA_INVALID");
    }
  }
}
