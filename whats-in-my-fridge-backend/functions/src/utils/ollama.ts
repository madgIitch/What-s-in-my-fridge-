import axios from "axios";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_URL ?? "https://ollama-service-534730978435.europe-west1.run.app";

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

/**
 * Calls the Ollama /api/generate endpoint and returns the response text.
 */
export async function callOllama(
  prompt: string,
  timeoutMs: number,
  model: string = OLLAMA_MODEL
): Promise<string> {
  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/generate`,
    {
      model,
      prompt,
      stream: false,
    },
    {
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
    }
  );
  return response.data.response ?? "";
}
