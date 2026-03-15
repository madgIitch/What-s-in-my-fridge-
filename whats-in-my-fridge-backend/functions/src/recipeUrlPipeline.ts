import axios from "axios";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { callOllama } from "./utils/ollama";

const WHISPER_URL = process.env.WHISPER_URL ?? "https://whisper-service-534730978435.europe-west1.run.app";

export type RecipeSourceType = "youtube" | "instagram" | "tiktok" | "blog" | "manual";

export interface RecipePipelineResult {
  ingredients: string[];
  steps: string[];
  sourceType: RecipeSourceType;
  rawText: string;
  recipeTitle?: string;
}

export function detectUrlType(url: string): Exclude<RecipeSourceType, "manual"> {
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

export async function extractRawText(
  url: string,
  sourceType: Exclude<RecipeSourceType, "manual">
): Promise<{ rawText: string; recipeTitle: string }> {
  switch (sourceType) {
    case "youtube":
      return extractFromYouTube(url);
    case "instagram":
      return extractFromInstagram(url);
    case "tiktok":
      return extractFromTikTok(url);
    case "blog":
    default:
      return extractFromBlog(url);
  }
}

export async function runRecipePipeline(params: {
  url: string;
  manualText?: string;
}): Promise<RecipePipelineResult> {
  const { url, manualText } = params;

  let rawText = "";
  let recipeTitle = "";
  let sourceType: RecipeSourceType = "blog";

  if (manualText && manualText.trim().length > 0) {
    rawText = manualText.trim();
    sourceType = "manual";
  } else {
    sourceType = detectUrlType(url);
    ({ rawText, recipeTitle } = await extractRawText(url, sourceType));
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error("No se pudo extraer texto de la URL");
  }

  const [ingredients, steps] = await Promise.all([
    extractIngredientsWithOllama(rawText),
    extractStepsWithOllama(rawText),
  ]);

  return {
    ingredients,
    steps,
    sourceType,
    rawText,
    recipeTitle,
  };
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
    console.warn(`No se pudo extraer titulo de YouTube: ${error.message}`);
  }

  let audioText = await transcribeWithWhisper(url);

  if (audioText.length < 50) {
    let transcriptText = "";
    try {
      const transcriptEs = await YoutubeTranscript.fetchTranscript(url, { lang: "es" });
      transcriptText = transcriptItemsToText(transcriptEs);
    } catch (error: any) {
      console.warn(`youtube-transcript (es) fallo: ${error.message}`);
    }

    if (transcriptText.length < 50) {
      try {
        const transcriptAny = await YoutubeTranscript.fetchTranscript(url);
        transcriptText = transcriptItemsToText(transcriptAny);
      } catch (error: any) {
        console.warn(`youtube-transcript (auto) fallo: ${error.message}`);
      }
    }

    audioText = transcriptText;
  }

  const rawText = combineTextParts([title, audioText]);
  if (rawText.length < 30) {
    throw new Error(
      "No se pudo extraer texto util del video de YouTube (ni audio ni subtitulos). " +
      "Prueba con otra URL publica o usa texto manual."
    );
  }

  return { rawText, recipeTitle: title };
}

async function extractFromInstagram(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  let title = "Receta de Instagram";

  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);
    title = $('meta[property="og:title"]').attr("content") || title;
  } catch (error: any) {
    console.warn(`Scraping de Instagram incompleto: ${error.message}`);
  }

  const audioText = await transcribeWithWhisper(url);
  const rawText = combineTextParts([title, audioText]);

  if (rawText.length < 20) {
    throw new Error(
      "No se pudo extraer el audio del video de Instagram/Reels. " +
      "Por favor, usa texto manual con descripcion/ingredientes."
    );
  }

  return { rawText, recipeTitle: title };
}

async function extractFromTikTok(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  let title = "Receta de TikTok";

  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);
    title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      title;
  } catch (error: any) {
    console.warn(`Scraping de TikTok incompleto: ${error.message}`);
  }

  const audioText = await transcribeWithWhisper(url);
  const rawText = combineTextParts([title, audioText]);

  if (rawText.length < 20) {
    throw new Error(
      "No se pudo extraer el audio del video de TikTok. " +
      "Por favor, usa texto manual con descripcion/ingredientes."
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
      throw new Error("No se pudo extraer suficiente contenido de la pagina web");
    }

    return { rawText: rawText.substring(0, 2000), recipeTitle: title.trim() };
  } catch (error: any) {
    throw new Error(`Error al procesar la pagina web: ${error.message}`);
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
  return `Extrae SOLO los ingredientes de esta receta. El texto puede ser la transcripcion de un video.
Lista cada ingrediente en una linea separada, sin cantidades, solo el nombre del ingrediente.
Responde SIEMPRE en espanol, traduciendo los ingredientes si el texto esta en otro idioma.
No incluyas instrucciones ni pasos de preparacion.

Texto de la receta:
${inputText}

Ingredientes:`;
}

async function extractIngredientsWithOllama(text: string): Promise<string[]> {
  try {
    const primaryPrompt = buildOllamaPrompt(text.substring(0, 3000));
    const primaryOutput = await callOllama(primaryPrompt, 180000);
    const primaryIngredients = parseIngredientsFromModelOutput(primaryOutput);
    if (primaryIngredients.length > 0) {
      return primaryIngredients;
    }

    const retryPrompt = buildOllamaPrompt(text.substring(0, 1500));
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
  const stepsPrompt = `Extrae los pasos de preparacion de esta receta. El texto puede ser la transcripcion de un video.
Devuelve una lista de pasos, uno por linea, en el orden en que aparecen.
Responde SIEMPRE en espanol, traduciendo los pasos si el texto esta en otro idioma.
Incluye solo instrucciones de preparacion y coccion, no ingredientes ni cantidades.
Cada paso debe ser claro y conciso.

Texto de la receta:
${text.substring(0, 4000)}

Pasos:`;

  try {
    const output = await callOllama(stepsPrompt, 120000);
    const steps = parseStepsFromModelOutput(output);
    if (steps.length > 0) {
      return steps;
    }
    return [];
  } catch (error: any) {
    console.warn(`No se pudieron extraer pasos: ${error.message}`);
    return [];
  }
}
