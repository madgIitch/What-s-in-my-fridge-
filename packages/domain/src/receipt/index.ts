export const RECEIPT_PARSER_VERSION = "receipt-v1" as const;

export type ReceiptItem = {
  lineId: string;
  rawText: string;
  name: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  confidence: number | null;
  accepted: boolean;
};

export type ReceiptDraft = {
  merchant: string | null;
  purchaseDate: string | null;
  currency: string | null;
  total: string | null;
  items: ReceiptItem[];
  unrecognizedLines: string[];
};

const money = /(?:^|\s)(-?\d{1,7}(?:[.,]\d{1,2})?)\s*(?:€|eur|usd|gbp)?\s*$/i;
const quantity = /^(?:(\d+(?:[.,]\d+)?)\s*[xX]\s*)?(.+?)(?:\s+(\d+(?:[.,]\d{1,2})?))?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function decimal(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  return normalized.replace(/^0+(?=\d)/, "");
}

function dateFrom(line: string, locale: string): string | null {
  const value = line.trim();
  if (isoDate.test(value)) return value;
  const match = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (!match) return null;
  const a = Number(match[1]); const b = Number(match[2]);
  if (a <= 12 && b <= 12) return null;
  const day = locale.toLowerCase().startsWith("en-us") ? b : a;
  const month = locale.toLowerCase().startsWith("en-us") ? a : b;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseReceipt(text: string, locale = "es-ES"): ReceiptDraft {
  const normalized = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const draft: ReceiptDraft = { merchant: normalized[0] ?? null, purchaseDate: null, currency: null, total: null, items: [], unrecognizedLines: [] };
  if (!normalized.length) return draft;
  if (/(?:€|\bEUR\b)/i.test(text)) draft.currency = "EUR";
  else if (/(?:\$|\bUSD\b)/i.test(text)) draft.currency = "USD";
  else if (/(?:£|\bGBP\b)/i.test(text)) draft.currency = "GBP";

  normalized.forEach((line, index) => {
    const maybeDate = dateFrom(line, locale);
    if (maybeDate) { draft.purchaseDate ??= maybeDate; return; }
    const totalMatch = line.match(/\btotal\b[^\d-]*(-?\d+(?:[.,]\d{1,2})?)/i);
    if (totalMatch) { draft.total = decimal(totalMatch[1]); return; }
    if (index === 0 || /^(subtotal|iva|tax|descuento|discount|fecha|date)\b/i.test(line)) { draft.unrecognizedLines.push(line); return; }
    const priceMatch = line.match(money);
    const body = priceMatch ? line.slice(0, priceMatch.index! + (priceMatch[0].startsWith(" ") ? 0 : 0)).trim() : line;
    const parsed = body.match(quantity);
    const name = parsed?.[2]?.trim() || null;
    const qty = decimal(parsed?.[1]);
    const price = decimal(priceMatch?.[1]);
    if (name && (qty || price)) {
      draft.items.push({ lineId: `line-${index + 1}`, rawText: line, name, quantity: qty ?? "1", unit: "unit", unitPrice: null, totalPrice: price, confidence: 0.8, accepted: true });
    } else draft.unrecognizedLines.push(line);
  });
  if (!draft.items.length) draft.unrecognizedLines = normalized;
  return draft;
}

export function validateConfirmLines(value: unknown): ReceiptItem[] {
  if (!Array.isArray(value)) throw new Error("INVALID_LINES");
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw new Error("INVALID_LINES");
    const line = candidate as Partial<ReceiptItem>;
    const validDecimal = (v: unknown) => v === null || (typeof v === "string" && /^\d+(?:\.\d{1,2})?$/.test(v));
    if (typeof line.lineId !== "string" || typeof line.accepted !== "boolean") throw new Error("INVALID_LINES");
    if (line.accepted && (typeof line.name !== "string" || !line.name.trim() || typeof line.quantity !== "string" || !/^\d+(?:\.\d+)?$/.test(line.quantity) || Number(line.quantity) <= 0)) throw new Error("INVALID_LINES");
    if (![line.unitPrice, line.totalPrice].every(validDecimal)) throw new Error("INVALID_LINES");
    return { lineId: line.lineId, rawText: typeof line.rawText === "string" ? line.rawText : "", name: typeof line.name === "string" ? line.name.trim() : null, quantity: line.quantity ?? null, unit: typeof line.unit === "string" ? line.unit.trim() || null : null, unitPrice: line.unitPrice ?? null, totalPrice: line.totalPrice ?? null, confidence: typeof line.confidence === "number" ? line.confidence : null, accepted: line.accepted };
  });
}
