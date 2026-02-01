import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import vision from "@google-cloud/vision";
import { ParsedDraftEntity, ParsedItem } from "./types";

type VisionClient = InstanceType<typeof vision.ImageAnnotatorClient>;
let visionClient: VisionClient | null = null;

const getVisionClient = (): VisionClient => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }
  return visionClient;
};

/**
 * Cloud Function para procesar tickets con OCR
 * - En emuladores: usa texto simulado
 * - En producción: usa Google Cloud Vision API
 */
export const parseReceipt = functions.https.onCall(async (data, context) => {
  // Detectar entorno de emulador
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

  // Validar autenticación (solo en producción)
  if (!isEmulator && !context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
  }

  const { imageUri } = data;
  if (!imageUri) {
    throw new functions.https.HttpsError("invalid-argument", "imageUri es requerido");
  }

  try {
    let rawText: string;

    // Usar texto simulado en emuladores, Vision API en producción
    if (isEmulator) {
      console.log("🔧 Modo emulador: usando texto OCR simulado");
      rawText = `  
E-Center Berlin  
Kaiserin-Augusta-Str. 123  
Tel: 030-12345678  
  
Datum: 28.01.2025  
  
Milch Frisch                 1,20 A  
Brot Vollkorn                2,50 A  
Tomate Bio                   3,30 A  
Käse Gouda                   4,80 A  
  
SUMME  
11,80  
  
MwSt 7%: 0,83  
Vielen Dank für Ihren Einkauf!  
      `.trim();
    } else {
      console.log("🔐 Modo producción: usando Vision API");
      const client = getVisionClient();
      const [result] = await client.textDetection(imageUri);
      rawText = result.fullTextAnnotation?.text || "";
    }

    // Parsear texto extraído
    const parsedInfo = parseReceiptText(rawText);

    // Crear draft entity
    const draft: ParsedDraftEntity = {
      rawText,
      merchant: parsedInfo.merchant,
      purchaseDate: parsedInfo.date,
      currency: parsedInfo.currency,
      total: parsedInfo.total,
      linesJson: JSON.stringify(parsedInfo.items),
      unrecognizedLines: JSON.stringify(parsedInfo.unrecognizedLines),
    };

    // Determinar userId según entorno
    const userId = isEmulator ? "test-user-123" : context.auth!.uid;

    // Guardar en Firestore con timestamp simple
    const draftRef = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("drafts")
      .add({
        ...draft,
        timestamp: Date.now(),
      });

    console.log(`✅ Draft creado: ${draftRef.id}`);

    return {
      draftId: draftRef.id,
      draft,
    };
  } catch (error: any) {
    console.error("❌ Error procesando ticket:", error);
    throw new functions.https.HttpsError("internal", `Error procesando imagen: ${error.message}`);
  }
});

/**
 * Parsea texto OCR para extraer información estructurada del ticket
 * Lógica adaptada de ScanVm.kt:162-403 del proyecto Android
 */
function parseReceiptText(text: string): {
  merchant: string | null;
  date: string | null;
  currency: string;
  total: number | null;
  items: ParsedItem[];
  unrecognizedLines: string[];
} {
  const lines = text.split("\n");

  // Buscar merchant (tiendas conocidas)
  const merchantCandidates = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const merchant =
    merchantCandidates.find(
      (line) =>
        (line.includes("Center") || line.includes("Market") || line.includes("E-")) &&
        !/\d/.test(line)
    ) ||
    merchantCandidates.find((line) => !/\d/.test(line)) ||
    null;

  // Buscar fecha con regex
  const dateRegex = /(\d{2}[./]\d{2}[./]\d{4})|(\d{4}-\d{2}-\d{2})/;
  const dateMatch = text.match(dateRegex);
  const date = dateMatch ? dateMatch[0].substring(0, 10) : null;

  // Buscar total después de "SUMME"
  const summeIndex = lines.findIndex((line) => line.trim().startsWith("SUMME"));
  let total: number | null = null;
  if (summeIndex >= 0) {
    for (let i = summeIndex + 1; i < Math.min(summeIndex + 30, lines.length); i++) {
      const amountMatch = lines[i].trim().match(/^(\d+),(\d{2})$/);
      if (amountMatch) {
        total = parseFloat(`${amountMatch[1]}.${amountMatch[2]}`);
        break;
      }
    }
  }

  // Parsear items individuales
  const items: ParsedItem[] = [];
  const unrecognizedLines: string[] = [];
  const productNames: string[] = [];
  const productPrices: number[] = [];

  // Patrones regex para diferentes formatos de tickets
  const namePattern = /^([A-ZÄÖÜ&][A-ZÄÖÜa-zäöü&.\s-]+)$/;
  const pricePatternA = /^(\d+),(\d{2})\s+A$/;
  const pricePatternB = /^(\d+),?\s*(\d{2})\s+B$/;
  const weightPattern = /^\s*(\d+),?\s*(\d+)\s*kg\s*x\s*(\d+),(\d{2})\s*EUR\/kg/;

  const isMetadataLine = (line: string): boolean => {
    const normalized = line.trim();
    if (!normalized) {
      return true;
    }

    if (merchant && normalized === merchant) {
      return true;
    }

    if (
      normalized.includes("Tel") ||
      normalized.includes("UID") ||
      normalized.includes("Steuer") ||
      normalized.includes("SUMME") ||
      normalized.includes("MwSt") ||
      normalized.includes("Vielen Dank") ||
      normalized.includes("Posten") ||
      normalized === "EUR" ||
      normalized.includes("Visa") ||
      normalized.includes("Beleg") ||
      normalized.includes("Datum") ||
      normalized.includes("Uhrzeit") ||
      normalized.includes("Trace") ||
      normalized.includes("Bezahlung") ||
      normalized.includes("Contactless") ||
      normalized.includes("Debit")
    ) {
      return true;
    }

    if (/^\d{5}\b/.test(normalized)) {
      return true;
    }

    if (/^\d{1,2}:\d{2}:\d{2}/.test(normalized)) {
      return true;
    }

    if (/(str\.?|strasse|damm|weg|platz|allee|gasse)\b/i.test(normalized)) {
      return true;
    }

    return false;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (isMetadataLine(line)) {
      i++;
      continue;
    }

    // Ignorar líneas vacías y metadata
    if (
      !line ||
      line.length < 2 ||
      line.includes("Tel") ||
      line.includes("UID") ||
      line.includes("Steuer") ||
      line.includes("SUMME") ||
      line.includes("MwSt") ||
      line.includes("Vielen Dank")
    ) {
      i++;
      continue;
    }

    let matched = false;

    // Capturar precio formato A (E-Center)
    const priceMatchA = line.match(pricePatternA);
    if (priceMatchA) {
      const price = parseFloat(`${priceMatchA[1]}.${priceMatchA[2]}`);
      productPrices.push(price);
      matched = true;
      i++;
      continue;
    }

    // Capturar precio formato B (Kaiserin)
    const priceMatchB = line.match(pricePatternB);
    if (priceMatchB) {
      const price = parseFloat(`${priceMatchB[1]}.${priceMatchB[2]}`);
      productPrices.push(price);
      matched = true;
      i++;
      continue;
    }

    // Capturar nombre + peso en siguiente línea
    const nameMatch = line.match(namePattern);
    if (nameMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const weightMatch = nextLine.match(weightPattern);

      if (weightMatch) {
        const weight = parseFloat(`${weightMatch[1]}.${weightMatch[2]}`);
        const pricePerKg = parseFloat(`${weightMatch[3]}.${weightMatch[4]}`);
        const totalPrice = pricePerKg * weight;

        items.push({
          name: `${nameMatch[1].trim()} (${weight}kg)`,
          quantity: 1,
          price: totalPrice,
        });
        matched = true;
        i += 2;
        continue;
      }

      // Guardar nombre para emparejar después
      const name = nameMatch[1].trim();
      if (name.length > 3 && !name.includes("Berlin")) {
        productNames.push(name);
        matched = true;
        i++;
        continue;
      }
    }

    // Línea no reconocida
    if (!matched && line.length > 2) {
      unrecognizedLines.push(line);
    }
    i++;
  }

  // Emparejar nombres con precios
  const minSize = Math.min(productNames.length, productPrices.length);
  for (let j = 0; j < minSize; j++) {
    items.push({
      name: productNames[j],
      quantity: 1,
      price: productPrices[j],
    });
  }

  return {
    merchant,
    date,
    currency: "EUR",
    total,
    items,
    unrecognizedLines,
  };
}
