import * as functions from "firebase-functions";
import axios from "axios";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

// URL del servicio Ollama en Cloud Run
const OLLAMA_URL = "https://ollama-service-534730978435.europe-west1.run.app";
const OLLAMA_MODEL = "qwen2.5:3b";

interface ParseRecipeFromUrlRequest {
  url: string;
  manualText?: string; // Para Instagram/TikTok, el usuario puede pegar el texto manualmente
}

interface ParseRecipeFromUrlResponse {
  ingredients: string[];
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  rawText: string;
  recipeTitle?: string;
}

/**
 * Cloud Function para parsear recetas de URLs (YouTube, Instagram, TikTok, blogs)
 * y extraer ingredientes usando Ollama
 */
export const parseRecipeFromUrl = functions
  .region("europe-west1")
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .https.onCall(async (data: ParseRecipeFromUrlRequest, context): Promise<ParseRecipeFromUrlResponse> => {
    // Validar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const { url, manualText } = data;

    try {
      console.log(`🔍 Procesando URL: ${url}`);

      let rawText = "";
      let recipeTitle = "";
      let sourceType: ParseRecipeFromUrlResponse["sourceType"] = "blog";

      // Si el usuario provee texto manual (para Instagram/TikTok)
      if (manualText && manualText.trim().length > 0) {
        rawText = manualText;
        sourceType = "manual";
        console.log("📝 Usando texto manual proporcionado por el usuario");
      } else {
        // Detectar tipo de URL
        sourceType = detectUrlType(url);
        console.log(`📱 Tipo de fuente detectado: ${sourceType}`);

        // Extraer contenido según el tipo
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

      console.log(`📄 Texto extraído (${rawText.length} caracteres)`);

      // Llamar a Ollama para extraer ingredientes
      const ingredients = await extractIngredientsWithOllama(rawText);

      console.log(`✅ Ingredientes extraídos: ${ingredients.length} items`);

      return {
        ingredients,
        sourceType,
        rawText: rawText.substring(0, 500), // Retornar solo los primeros 500 caracteres
        recipeTitle,
      };
    } catch (error: any) {
      console.error("❌ Error en parseRecipeFromUrl:", error);

      // Si ya es un HttpsError, re-lanzarlo
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Sino, crear un nuevo error
      throw new functions.https.HttpsError("internal", `Error procesando la receta: ${error.message}`);
    }
  });

/**
 * Detecta el tipo de URL (YouTube, Instagram, TikTok, blog)
 */
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

/**
 * Extrae información de videos de YouTube usando transcripciones automáticas
 * Esto captura lo que se dice en el video, ideal para recetas
 */
async function extractFromYouTube(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  try {
    // Primero, extraer metadatos (título) del HTML
    let title = "";
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 15000,
      });
      const $ = cheerio.load(response.data);
      title = $('meta[property="og:title"]').attr("content") || $("title").text() || "Video de YouTube";
    } catch (error) {
      console.warn("No se pudo extraer el título del video, continuando con transcripción...");
      title = "Receta de YouTube";
    }

    // Extraer transcripción del video (subtítulos automáticos)
    console.log("🎥 Extrayendo transcripción de YouTube...");
    const transcript = await YoutubeTranscript.fetchTranscript(url);

    if (!transcript || transcript.length === 0) {
      throw new Error("Este video no tiene subtítulos disponibles");
    }

    // Convertir la transcripción a texto continuo
    const transcriptText = transcript
      .map((item: any) => item.text)
      .join(" ")
      .replace(/\s+/g, " ") // Limpiar espacios múltiples
      .trim();

    console.log(`📝 Transcripción extraída: ${transcriptText.length} caracteres`);

    if (transcriptText.length < 50) {
      throw new Error("La transcripción es demasiado corta");
    }

    // Combinar título y transcripción
    const rawText = `${title}\n\n${transcriptText}`;

    return { rawText, recipeTitle: title };
  } catch (error: any) {
    console.error("Error extrayendo de YouTube:", error.message);

    // Si falla la transcripción, dar mensaje útil
    if (error.message.includes("subtítulos") || error.message.includes("transcript")) {
      throw new Error(
        "Este video no tiene subtítulos disponibles. " +
        "Por favor, copia manualmente los ingredientes del video y pégalos en el campo 'Texto manual'."
      );
    }

    throw new Error(`Error al procesar el video de YouTube: ${error.message}`);
  }
}

/**
 * Extrae información de posts de Instagram
 * Nota: Instagram tiene protecciones anti-scraping, esta implementación
 * intenta extraer metadatos básicos del HTML
 */
async function extractFromInstagram(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // Intentar extraer título/caption del meta tag
    const title = $('meta[property="og:title"]').attr("content") || "Receta de Instagram";
    const description = $('meta[property="og:description"]').attr("content") || "";

    // Intentar extraer del meta tag de descripción alternativo
    const metaDescription = $('meta[name="description"]').attr("content") || "";

    // Buscar scripts JSON-LD que a veces contienen la descripción
    let jsonData = "";
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const jsonText = $(elem).html();
        if (jsonText) {
          const data = JSON.parse(jsonText);
          if (data.description) {
            jsonData += data.description + "\n";
          }
          if (data.caption) {
            jsonData += data.caption + "\n";
          }
        }
      } catch (e) {
        // Ignorar errores de parsing JSON
      }
    });

    // Combinar todo el texto extraído
    const rawText = `${title}\n\n${description}\n${metaDescription}\n${jsonData}`.trim();

    if (!rawText || rawText.length < 20) {
      throw new Error(
        "No se pudo extraer suficiente información de Instagram. " +
        "Por favor, copia la descripción del post y pégala en el campo 'Texto manual' en la app."
      );
    }

    return { rawText, recipeTitle: title };
  } catch (error: any) {
    console.error("Error extrayendo de Instagram:", error.message);
    // Si falla, dar instrucciones claras al usuario
    throw new Error(
      "Instagram tiene protecciones que dificultan la extracción automática. " +
      "Por favor, copia la descripción/ingredientes del post y pégalos en el campo 'Texto manual' en la app."
    );
  }
}

/**
 * Extrae información de videos de TikTok
 * Nota: TikTok tiene protecciones anti-scraping, esta implementación
 * intenta extraer metadatos básicos del HTML
 */
async function extractFromTikTok(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // Intentar extraer título del video
    const title = $('meta[property="og:title"]').attr("content") ||
                  $('meta[name="twitter:title"]').attr("content") ||
                  "Receta de TikTok";

    // Intentar extraer descripción
    const description = $('meta[property="og:description"]').attr("content") ||
                        $('meta[name="twitter:description"]').attr("content") ||
                        $('meta[name="description"]').attr("content") || "";

    // Buscar scripts JSON que TikTok a veces incluye
    let jsonData = "";
    $('script[id*="__UNIVERSAL_DATA_FOR_REHYDRATION__"]').each((_, elem) => {
      try {
        const jsonText = $(elem).html();
        if (jsonText) {
          const data = JSON.parse(jsonText);
          // TikTok a veces tiene la descripción en __DEFAULT_SCOPE__
          if (data.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.desc) {
            jsonData = data.__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct.desc;
          }
        }
      } catch (e) {
        // Ignorar errores de parsing JSON
      }
    });

    // Combinar todo el texto extraído
    const rawText = `${title}\n\n${description}\n${jsonData}`.trim();

    if (!rawText || rawText.length < 20) {
      throw new Error(
        "No se pudo extraer suficiente información de TikTok. " +
        "Por favor, copia la descripción del video y pégala en el campo 'Texto manual' en la app."
      );
    }

    return { rawText, recipeTitle: title };
  } catch (error: any) {
    console.error("Error extrayendo de TikTok:", error.message);
    // Si falla, dar instrucciones claras al usuario
    throw new Error(
      "TikTok tiene protecciones que dificultan la extracción automática. " +
      "Por favor, copia la descripción/ingredientes del video y pégalos en el campo 'Texto manual' en la app."
    );
  }
}

/**
 * Extrae contenido de blogs/páginas web de recetas
 */
async function extractFromBlog(url: string): Promise<{ rawText: string; recipeTitle: string }> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // Extraer título
    const title =
      $('h1[class*="recipe"]').first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "";

    // Buscar secciones de ingredientes (patrones comunes)
    let ingredientsText = "";

    // Buscar elementos que probablemente contengan ingredientes
    const ingredientSelectors = [
      '[class*="ingredient"]',
      '[id*="ingredient"]',
      'ul[class*="recipe"]',
      '.recipe-ingredients',
      '#ingredients',
      'div[class*="ingredients"]',
    ];

    for (const selector of ingredientSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, elem) => {
          ingredientsText += $(elem).text() + "\n";
        });
        if (ingredientsText.length > 50) {
          break; // Ya encontramos suficiente contenido
        }
      }
    }

    // Si no encontramos ingredientes específicos, extraer todo el texto visible
    if (ingredientsText.length < 50) {
      // Remover scripts, styles, etc.
      $("script, style, nav, header, footer, aside").remove();

      // Extraer texto del body
      ingredientsText = $("body").text().replace(/\s+/g, " ").trim();
    }

    const rawText = `${title}\n\n${ingredientsText}`.trim();

    if (!rawText || rawText.length < 20) {
      throw new Error("No se pudo extraer suficiente contenido de la página web");
    }

    return { rawText: rawText.substring(0, 2000), recipeTitle: title.trim() }; // Limitar a 2000 caracteres
  } catch (error: any) {
    console.error("Error extrayendo de blog:", error.message);
    throw new Error(`Error al procesar la página web: ${error.message}`);
  }
}

/**
 * Llama a Ollama en Cloud Run para extraer ingredientes del texto
 */
async function extractIngredientsWithOllama(text: string): Promise<string[]> {
  try {
    const prompt = `Extrae SOLO los ingredientes de esta receta. Lista cada ingrediente en una línea separada, sin cantidades, solo el nombre del ingrediente en español. No incluyas instrucciones ni pasos de preparación.

Texto de la receta:
${text.substring(0, 1500)}

Ingredientes:`;

    console.log(`🤖 Llamando a Ollama en ${OLLAMA_URL}...`);

    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      },
      {
        timeout: 90000, // 90 segundos
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const ollamaResponse = response.data.response;
    console.log(`🤖 Respuesta de Ollama: ${ollamaResponse}`);

    // Parsear la respuesta de Ollama
    const ingredients = ollamaResponse
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => {
        // Remover números, guiones, asteriscos al inicio
        return line.replace(/^[\d\-\*\.\)\(]+\s*/, "").trim();
      })
      .filter((line: string) => line.length > 2 && line.length < 100) // Filtrar líneas muy cortas o muy largas
      .slice(0, 30); // Máximo 30 ingredientes

    if (ingredients.length === 0) {
      throw new Error("Ollama no pudo extraer ingredientes del texto");
    }

    return ingredients;
  } catch (error: any) {
    console.error("Error llamando a Ollama:", error.message);
    throw new Error(`Error al extraer ingredientes con Ollama: ${error.message}`);
  }
}
