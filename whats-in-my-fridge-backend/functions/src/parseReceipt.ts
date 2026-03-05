import * as functions from "firebase-functions";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import vision from "@google-cloud/vision";
import { ParsedDraftEntity, ParsedItem } from "./types";
import { checkAndIncrementUsage, FREE_OCR_LIMIT } from "./usageLimits";

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

  const { imageUri, locale } = data;
  if (!imageUri) {
    throw new functions.https.HttpsError("invalid-argument", "imageUri es requerido");
  }

  const start = Date.now();
  const userId = isEmulator ? "test-user-123" : context.auth!.uid;
  const parserConfig = getParserConfig(locale);

  try {
    // Enforce server-side monthly usage limit (skip in emulator)
    if (!isEmulator) {
      await checkAndIncrementUsage(userId, "ocrScansUsed", FREE_OCR_LIMIT);
    }

    let rawText: string;

    // Usar texto simulado en emuladores, Vision API en producción
    if (isEmulator) {
      console.log("🔧 Modo emulador: usando texto OCR simulado");
      rawText = `
Mercadona S.A.
C/ Gran Via 45
Tel: 910-123456

Fecha: 28/01/2025 Hora: 11:32

LECHE FRESCA 1L              0,65 A
PAN INTEGRAL 500G            1,20 A
TOMATE 1KG                   1,85 A
QUESO MANCHEGO 250G          3,50 B

TOTAL
7,20

IVA 4%: 0,08
IVA 10%: 0,37
Gracias por su compra
      `.trim();
    } else {
      console.log("🔐 Modo producción: usando Vision API");
      const client = getVisionClient();
      const [result] = await client.textDetection(imageUri);
      rawText = result.fullTextAnnotation?.text || "";
    }

    // Parsear texto extraído
    const parsedInfo = parseReceiptText(rawText, parserConfig);

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

    logger.info("feature_usage", {
      feature: "ocr_scan",
      userId,
      durationMs: Date.now() - start,
      success: true,
      isEmulator,
      itemsFound: parsedInfo.items.length,
      merchant: parsedInfo.merchant,
    });

    return {
      draftId: draftRef.id,
      draft,
    };
  } catch (error: any) {
    logger.error("feature_usage", {
      feature: "ocr_scan",
      userId,
      durationMs: Date.now() - start,
      success: false,
      error: error.message,
    });
    throw new functions.https.HttpsError("internal", `Error procesando imagen: ${error.message}`);
  }
});

// ── Locale-aware parser config ──────────────────────────────────────────────

interface ReceiptParserConfig {
  /** Keywords that appear on the line preceding the total amount. */
  totalKeywords: string[];
  /** Substrings that identify non-product (metadata) lines. */
  metadataKeywords: string[];
  /** Pattern to detect address lines. */
  addressPattern: RegExp;
  /** Pattern for a standalone product name line (no price on same line). */
  namePattern: RegExp;
  /** Hints used to identify the merchant line. */
  merchantKeywords: string[];
  /** Decimal separator used by this locale. */
  decimalSeparator: "," | ".";
  /** Fallback currency when none is detected from the receipt text. */
  defaultCurrency: string;
}

const LOCALE_CONFIGS: Record<string, ReceiptParserConfig> = {
  "de-DE": {
    totalKeywords: ["SUMME", "GESAMT", "ZU ZAHLEN"],
    metadataKeywords: [
      "Tel", "UID", "Steuer", "SUMME", "MwSt", "Vielen Dank",
      "Posten", "EUR", "Visa", "Beleg", "Datum", "Uhrzeit",
      "Trace", "Bezahlung", "Contactless", "Debit",
    ],
    addressPattern: /(str\.?|strasse|damm|weg|platz|allee|gasse)\b/i,
    namePattern: /^([A-ZÄÖÜ&][A-ZÄÖÜa-zäöü&.\s-]+)$/,
    merchantKeywords: ["Center", "Market", "Markt", "E-"],
    decimalSeparator: ",",
    defaultCurrency: "EUR",
  },
  "es-ES": {
    totalKeywords: ["TOTAL", "IMPORTE", "A PAGAR", "TOTAL A PAGAR", "TOTAL FACTURA"],
    metadataKeywords: [
      "Tel", "NIF", "CIF", "IVA", "Gracias", "TOTAL", "Fecha",
      "Hora", "Ticket", "Factura", "Base", "Cuota", "Subtotal",
      "Visa", "Contactless", "Debit", "EUR",
    ],
    addressPattern: /(calle|c\/|avda|av\.|plaza|paseo|pol\.)\b/i,
    namePattern: /^([A-ZÁÉÍÓÚÜÑ&][A-ZÁÉÍÓÚÜÑa-záéíóúüñ&.\s-]+)$/,
    merchantKeywords: [
      "Mercadona", "Carrefour", "Lidl", "Dia", "Eroski",
      "El Corte", "Supercor", "Supermercado", "Alimentación",
    ],
    decimalSeparator: ",",
    defaultCurrency: "EUR",
  },
  "es-MX": {
    totalKeywords: ["TOTAL", "TOTAL A PAGAR", "IMPORTE TOTAL", "SUBTOTAL"],
    metadataKeywords: [
      "Tel", "RFC", "IVA", "Gracias", "TOTAL", "Fecha",
      "Hora", "Ticket", "Folio", "Subtotal", "Visa",
      "Contactless", "Debit", "MXN",
    ],
    addressPattern: /(calle|col\.|colonia|av\.|blvd\.|fracc\.)\b/i,
    namePattern: /^([A-ZÁÉÍÓÚÜÑ&][A-ZÁÉÍÓÚÜÑa-záéíóúüñ&.\s-]+)$/,
    merchantKeywords: [
      "Walmart", "Soriana", "Oxxo", "Chedraui", "Costco",
      "La Comer", "Superama", "HEB",
    ],
    decimalSeparator: ".",
    defaultCurrency: "MXN",
  },
};

const DEFAULT_LOCALE = process.env.RECEIPT_LOCALE ?? "es-ES";

function getParserConfig(locale?: string): ReceiptParserConfig {
  const key = locale ?? DEFAULT_LOCALE;
  return LOCALE_CONFIGS[key] ?? LOCALE_CONFIGS["es-ES"];
}

/** Detects the currency from symbols or keywords in the receipt text. */
function detectCurrency(text: string, fallback: string): string {
  if (text.includes("€")) return "EUR";
  if (/\bEUR\b/.test(text)) return "EUR";
  if (text.includes("£")) return "GBP";
  if (/\bGBP\b/.test(text)) return "GBP";
  if (/\bMXN\b/.test(text) || /\$\s*\d/.test(text) && /RFC|OXXO|Walmart/i.test(text)) return "MXN";
  if (text.includes("$") && /\bUSD\b/.test(text)) return "USD";
  if (text.includes("$")) return "USD";
  return fallback;
}

/** Parses a locale-formatted decimal string into a JS number. */
function parseDecimal(integer: string, fraction: string): number {
  return parseFloat(`${integer}.${fraction}`);
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parsea texto OCR para extraer información estructurada del ticket.
 * Acepta un config de locale para soportar diferentes mercados.
 */
function parseReceiptText(
  text: string,
  config: ReceiptParserConfig = LOCALE_CONFIGS["es-ES"]
): {
  merchant: string | null;
  date: string | null;
  currency: string;
  total: number | null;
  items: ParsedItem[];
  unrecognizedLines: string[];
} {
  const lines = text.split("\n");
  const dec = config.decimalSeparator === "," ? "," : "\\.";

  // ── Merchant ──
  const merchantCandidates = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const merchant =
    merchantCandidates.find(
      (line) => config.merchantKeywords.some((kw) => line.includes(kw)) && !/\d/.test(line)
    ) ||
    merchantCandidates.find((line) => !/\d/.test(line)) ||
    null;

  // ── Date ──
  const dateRegex = /(\d{2}[./]\d{2}[./]\d{4})|(\d{4}-\d{2}-\d{2})/;
  const dateMatch = text.match(dateRegex);
  const date = dateMatch ? dateMatch[0].substring(0, 10) : null;

  // ── Currency ──
  const currency = detectCurrency(text, config.defaultCurrency);

  // ── Total ──
  const totalLineIndex = lines.findIndex((line) =>
    config.totalKeywords.some((kw) => line.trim().toUpperCase().startsWith(kw))
  );
  let total: number | null = null;

  // Try to find total on the same line first (e.g. "TOTAL   7,20")
  if (totalLineIndex >= 0) {
    const totalLineText = lines[totalLineIndex];
    const inlineMatch = totalLineText.match(new RegExp(`(\\d+)${dec}(\\d{2})\\s*$`));
    if (inlineMatch) {
      total = parseDecimal(inlineMatch[1], inlineMatch[2]);
    } else {
      // Look on the lines immediately after
      for (let i = totalLineIndex + 1; i < Math.min(totalLineIndex + 5, lines.length); i++) {
        const amountMatch = lines[i].trim().match(new RegExp(`^(\\d+)${dec}(\\d{2})$`));
        if (amountMatch) {
          total = parseDecimal(amountMatch[1], amountMatch[2]);
          break;
        }
      }
    }
  }

  // ── Line patterns ──
  const priceWithTaxSuffix = new RegExp(`^(\\d+)${dec}(\\d{2})\\s+[AB]$`);
  const weightPattern = new RegExp(
    `^\\s*(\\d+)${dec}?\\s*(\\d+)\\s*kg\\s*x\\s*(\\d+)${dec}(\\d{2})\\s*(EUR|MXN|USD|GBP)?/kg`,
    "i"
  );
  const quantityItemPattern = new RegExp(
    `^(\\d+)\\s+([A-ZÁÉÍÓÚÜÑÄÖÜ][A-ZÁÉÍÓÚÜÑÄÖÜa-záéíóúüñäöü&.\\s-]+)$`
  );
  const unitPricePattern = new RegExp(`^á\\s*(\\d+)[${dec}.](\\d{2})(?:\\s+(\\d+)[${dec}.](\\d{2}))?$`);
  // Inline price at end of line: "LECHE ENTERA 1L   0,65 A" or "TOMATE 1KG   1,85"
  const inlineNamePricePattern = new RegExp(
    `^([A-ZÁÉÍÓÚÜÑÄÖÜ][A-ZÁÉÍÓÚÜÑÄÖÜa-záéíóúüñäöü0-9&.\\s%-]+?)\\s{2,}(\\d+)${dec}(\\d{2})(?:\\s+[AB])?$`
  );

  const isMetadataLine = (line: string): boolean => {
    const normalized = line.trim();
    if (!normalized) return true;
    if (merchant && normalized === merchant) return true;
    if (config.metadataKeywords.some((kw) => normalized.includes(kw))) return true;
    if (/^\d{5}\b/.test(normalized)) return true;          // postal code
    if (/^\d{1,2}:\d{2}(:\d{2})?/.test(normalized)) return true; // time
    if (config.addressPattern.test(normalized)) return true;
    return false;
  };

  // ── Parse items ──
  const items: ParsedItem[] = [];
  const unrecognizedLines: string[] = [];
  const pendingNames: string[] = [];
  const pendingPrices: number[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (isMetadataLine(line) || !line || line.length < 2) {
      i++;
      continue;
    }

    let matched = false;

    // 1. Inline name + price on same line (most Spanish receipts)
    const inlineMatch = line.match(inlineNamePricePattern);
    if (inlineMatch) {
      items.push({
        name: inlineMatch[1].trim(),
        quantity: 1,
        price: parseDecimal(inlineMatch[2], inlineMatch[3]),
      });
      matched = true;
      i++;
      continue;
    }

    // 2. Standalone price line with tax suffix (e.g. "1,20 A")
    const priceMatch = line.match(priceWithTaxSuffix);
    if (priceMatch) {
      pendingPrices.push(parseDecimal(priceMatch[1], priceMatch[2]));
      matched = true;
      i++;
      continue;
    }

    // 3. Quantity + name, price on next line (e.g. "3 TOMATES" / "á 1,09")
    const quantityItemMatch = line.match(quantityItemPattern);
    if (quantityItemMatch && i + 1 < lines.length) {
      const quantity = parseInt(quantityItemMatch[1], 10);
      const name = quantityItemMatch[2].trim();
      const nextLine = lines[i + 1].trim();
      const unitPriceMatch = nextLine.match(unitPricePattern);
      if (unitPriceMatch) {
        const unitPrice = parseDecimal(unitPriceMatch[1], unitPriceMatch[2]);
        const totalPrice =
          unitPriceMatch[3] && unitPriceMatch[4]
            ? parseDecimal(unitPriceMatch[3], unitPriceMatch[4])
            : unitPrice * quantity;
        items.push({ name: quantity > 1 ? `${name} (${quantity}x)` : name, quantity, price: totalPrice });
        matched = true;
        i += 2;
        continue;
      }
    }

    // 4. Name line followed by weight line (e.g. "LOMO" / "0,350 kg x 12,50 EUR/kg")
    const nameMatch = line.match(config.namePattern);
    if (nameMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const weightMatch = nextLine.match(weightPattern);
      if (weightMatch) {
        const weight = parseDecimal(weightMatch[1], weightMatch[2]);
        const pricePerKg = parseDecimal(weightMatch[3], weightMatch[4]);
        items.push({ name: `${nameMatch[1].trim()} (${weight}kg)`, quantity: 1, price: pricePerKg * weight });
        matched = true;
        i += 2;
        continue;
      }
      // Standalone name line — queue for deferred price pairing
      const name = nameMatch[1].trim();
      if (name.length > 2) {
        pendingNames.push(name);
        matched = true;
        i++;
        continue;
      }
    }

    if (!matched) {
      unrecognizedLines.push(line);
    }
    i++;
  }

  // Pair any deferred names with deferred prices (German-style layout)
  const minSize = Math.min(pendingNames.length, pendingPrices.length);
  for (let j = 0; j < minSize; j++) {
    items.push({ name: pendingNames[j], quantity: 1, price: pendingPrices[j] });
  }

  return { merchant, date, currency, total, items, unrecognizedLines };
}
