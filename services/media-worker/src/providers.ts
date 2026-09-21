import type { RecipeExtractionProvider, SourceType, TranscriptionProvider } from "./contracts.js";

async function providerFetch(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.INTERNAL_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
  return response.json() as Promise<Record<string, unknown>>;
}

function endpoint(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

export class WhisperProvider implements TranscriptionProvider {
  constructor(private endpoint: string) {}
  async transcribe(audioPath: string) {
    const result = await providerFetch(this.endpoint, { audioPath, format: "wav", sampleRate: 16000, channels: 1 });
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
    const result = await providerFetch(endpoint(this.baseUrl, "/api/generate"), {
      model: process.env.OLLAMA_RECIPE_MODEL ?? "qwen2.5:3b",
      prompt,
      format: "json",
      stream: false,
    });
    if (typeof result.response !== "string") throw new Error("PROVIDER_UNAVAILABLE");
    try {
      const parsed = JSON.parse(result.response) as Record<string, unknown>;
      return parsed.recipe ?? parsed;
    } catch {
      throw new Error("RECIPE_SCHEMA_INVALID");
    }
  }
}
