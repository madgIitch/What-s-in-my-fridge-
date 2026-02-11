import * as functions from "firebase-functions";
import axios from "axios";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

const OLLAMA_URL = "https://ollama-service-534730978435.europe-west1.run.app";
const OLLAMA_MODEL = "qwen2.5:3b";
const WHISPER_URL = "https://whisper-service-534730978435.europe-west1.run.app";

interface ParseRecipeFromUrlRequest {
  url: string;
  manualText?: string;
}

interface ParseRecipeFromUrlResponse {
  ingredients: string[];
  steps: string[];
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  rawText: string;
  recipeTitle?: string;
}

export const parseRecipeFromUrl = functions
  .region("europe-west1")
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .https.onCall(async (data: ParseRecipeFromUrlRequest, context): Promise<ParseRecipeFromUrlResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const { url, manualText } = data;
    if (!url || typeof url !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "URL inválida");
    }

    try {
      let rawText = "";
      let recipeTitle = "";
      let sourceType: ParseRecipeFromUrlResponse["sourceType"] = "blog";

      if (manualText && manualText.trim().length > 0) {
        rawText = manualText.trim();
        sourceType = "manual";
      } else {
        sourceType = detectUrlType(url);
        switch (sourceType) {
          case "youtube":
            ({ rawText, recipeTitle } = await extractFromYouTube(url));
            break;
          case "instagram":
            ({ rawText, recipeTitle } = await extractFromInstagram(url));
            break;
          case "tiktok":
            ({ rawText, recipeTitle } = await extractFromTikTok(url));
            break;
          case "blog":
          default:
            ({ rawText, recipeTitle } = await extractFromBlog(url));
            break;
        }
      }

      if (!rawText || rawText.trim().length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No se pudo extraer texto de la URL");
      }

      const ingredients = await extractIngredientsWithOllama(rawText);
      const steps = await extractStepsWithOllama(rawText);

      return {
        ingredients,
        steps,
        sourceType,
        rawText: rawText.substring(0, 500),
        recipeTitle,
      };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Error procesando la receta: ${error.message}`);
    }
  });

function detectUrlType(url: string): ParseRecipeFromUrlResponse["sourceType"] {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return "youtube";
  }
  if (urlLower.includes("instagram.com")) {
    return "instagram";
  }
  if (urlLower.includes("tiktok.com")) {
    return "tiktok";
  }
  return "blog";
}

function transcriptItemsToText(transcript: any[]): string {
  return transcript
    .map((item: any) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function combineTextParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function transcribeWithWhisper(url: string): Promise<string> {
  try {
    const response = await axios.post(
      `${WHISPER_URL}/transcribe`,
      { url, language: "en" },
      {
        timeout: 100000,
        headers: { "Content-Type": "application/json" },
      }
    );
    const text = response.data?.text;
    if (typeof text !== "string") {
      return "";
    }
    return text.replace(/\s+/g, " ").trim();
  } catch (error: any) {
    console.warn(`Whisper fallback no disponible: ${error.message}`);
    return "";
  }
}

async function fetchPageHtml(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    timeout: 30000,
  });
  return response.data;
}

async function extractFromYouTube(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  let title = "Receta de YouTube";
  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);
    title = $('meta[property="og:title"]').attr("content") || $("title").text() || title;
  } catch (error: any) {
    console.warn(`No se pudo extraer título de YouTube: ${error.message}`);
  }

  let transcriptText = "";
  try {
    const transcriptEs = await YoutubeTranscript.fetchTranscript(url, { lang: "es" });
    transcriptText = transcriptItemsToText(transcriptEs);
  } catch (error: any) {
    console.warn(`youtube-transcript (es) falló: ${error.message}`);
  }

  if (transcriptText.length < 50) {
    try {
      const transcriptAny = await YoutubeTranscript.fetchTranscript(url);
      transcriptText = transcriptItemsToText(transcriptAny);
    } catch (error: any) {
      console.warn(`youtube-transcript (auto) falló: ${error.message}`);
    }
  }

  if (transcriptText.length < 50) {
    transcriptText = await transcribeWithWhisper(url);
  }

  const rawText = combineTextParts([title, transcriptText]);
  if (rawText.length < 30) {
    throw new Error(
      "No se pudo extraer texto útil del video de YouTube (ni subtítulos ni audio). " +
      "Prueba con otra URL pública o usa texto manual."
    );
  }

  return { rawText, recipeTitle: title };
}

async function extractFromInstagram(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  let title = "Receta de Instagram";
  let description = "";
  let metaDescription = "";
  let jsonData = "";

  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);

    title = $('meta[property="og:title"]').attr("content") || title;
    description = $('meta[property="og:description"]').attr("content") || "";
    metaDescription = $('meta[name="description"]').attr("content") || "";

    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const jsonText = $(elem).html();
        if (!jsonText) {
          return;
        }
        const data = JSON.parse(jsonText);
        if (typeof data.description === "string") {
          jsonData += data.description + "\n";
        }
        if (typeof data.caption === "string") {
          jsonData += data.caption + "\n";
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
  } catch (error: any) {
    console.warn(`Scraping de Instagram incompleto: ${error.message}`);
  }

  const audioText = await transcribeWithWhisper(url);
  const rawText = combineTextParts([title, description, metaDescription, jsonData, audioText]);

  if (rawText.length < 20) {
    throw new Error(
      "No se pudo extraer suficiente información de Instagram/Reels. " +
      "Por favor, usa texto manual con descripción/ingredientes."
    );
  }

  return { rawText, recipeTitle: title };
}

async function extractFromTikTok(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  let title = "Receta de TikTok";
  let description = "";
  let jsonData = "";

  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);

    title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      title;

    description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    $('script[id*="__UNIVERSAL_DATA_FOR_REHYDRATION__"]').each((_, elem) => {
      try {
        const jsonText = $(elem).html();
        if (!jsonText) {
          return;
        }
        const data = JSON.parse(jsonText);
        const desc = data.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.desc;
        if (typeof desc === "string" && desc.length > 0) {
          jsonData = desc;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
  } catch (error: any) {
    console.warn(`Scraping de TikTok incompleto: ${error.message}`);
  }

  const audioText = await transcribeWithWhisper(url);
  const rawText = combineTextParts([title, description, jsonData, audioText]);

  if (rawText.length < 20) {
    throw new Error(
      "No se pudo extraer suficiente información de TikTok. " +
      "Por favor, usa texto manual con descripción/ingredientes."
    );
  }

  return { rawText, recipeTitle: title };
}

async function extractFromBlog(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);

    const title =
      $('h1[class*="recipe"]').first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "";

    let ingredientsText = "";
    const ingredientSelectors = [
      '[class*="ingredient"]',
      '[id*="ingredient"]',
      'ul[class*="recipe"]',
      ".recipe-ingredients",
      "#ingredients",
      'div[class*="ingredients"]',
    ];

    for (const selector of ingredientSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, elem) => {
          ingredientsText += $(elem).text() + "\n";
        });
        if (ingredientsText.length > 50) {
          break;
        }
      }
    }

    if (ingredientsText.length < 50) {
      $("script, style, nav, header, footer, aside").remove();
      ingredientsText = $("body").text().replace(/\s+/g, " ").trim();
    }

    const rawText = `${title}\n\n${ingredientsText}`.trim();
    if (!rawText || rawText.length < 20) {
      throw new Error("No se pudo extraer suficiente contenido de la página web");
    }

    return { rawText: rawText.substring(0, 2000), recipeTitle: title.trim() };
  } catch (error: any) {
    throw new Error(`Error al procesar la página web: ${error.message}`);
  }
}

function parseIngredientsFromModelOutput(output: string): string[] {
  return output
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .map((line: string) => line.replace(/^[\d\-\*\.\)\(]+\s*/, "").trim())
    .filter((line: string) => line.length > 2 && line.length < 100)
    .slice(0, 30);
}

function parseStepsFromModelOutput(output: string): string[] {
  return output
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .map((line: string) => line.replace(/^(paso\s*\d+[:.)-]*\s*|[\d\-\*\.)\(]+\s*)/i, "").trim())
    .filter((line: string) => line.length > 8 && line.length < 240)
    .slice(0, 20);
}

function buildOllamaPrompt(inputText: string): string {
  return `Extrae SOLO los ingredientes de esta receta. Lista cada ingrediente en una línea separada, sin cantidades, solo el nombre del ingrediente en español. No incluyas instrucciones ni pasos de preparación.

Texto de la receta:
${inputText}

Ingredientes:`;
}

async function callOllama(prompt: string, timeoutMs: number): Promise<string> {
  const response = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    },
    {
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.response || "";
}

async function extractIngredientsWithOllama(text: string): Promise<string[]> {
  try {
    const primaryPrompt = buildOllamaPrompt(text.substring(0, 1500));
    const primaryOutput = await callOllama(primaryPrompt, 180000);
    const primaryIngredients = parseIngredientsFromModelOutput(primaryOutput);
    if (primaryIngredients.length > 0) {
      return primaryIngredients;
    }

    const retryPrompt = buildOllamaPrompt(text.substring(0, 900));
    const retryOutput = await callOllama(retryPrompt, 180000);
    const retryIngredients = parseIngredientsFromModelOutput(retryOutput);
    if (retryIngredients.length > 0) {
      return retryIngredients;
    }

    throw new Error("Ollama no pudo extraer ingredientes del texto");
  } catch (error: any) {
    throw new Error(`Error al extraer ingredientes con Ollama: ${error.message}`);
  }
}

async function extractStepsWithOllama(text: string): Promise<string[]> {
  const stepsPrompt = `Extrae SOLO los pasos de preparación de esta receta.
Devuelve una lista de pasos, un paso por línea, en orden y en español.
No incluyas ingredientes ni cantidades.

Texto de la receta:
${text.substring(0, 1800)}

Pasos:`;

  try {
    const output = await callOllama(stepsPrompt, 120000);
    const steps = parseStepsFromModelOutput(output);
    if (steps.length > 0) {
      return steps;
    }
    return [];
  } catch (error: any) {
    // Los pasos son valor agregado: si falla, no tumbamos toda la función
    console.warn(`No se pudieron extraer pasos: ${error.message}`);
    return [];
  }
}
