import { ParsedItem } from '../../database/models/ParsedDraft';

/**
 * Receipt Parser Service
 * Migrated from Android ScanVm.kt
 * Parses OCR text to extract structured information (items, prices, merchant, date, total)
 */

export interface ParsedReceiptInfo {
  items: ParsedItem[];
  merchant: string | null;
  purchaseDate: string | null;
  total: number | null;
  currency: string;
  unrecognizedLines: string[];
}

/**
 * Parse receipt text to extract structured information
 * Supports multiple supermarket formats (E-Center, Kaiserin-Augusta, Mercadona, etc.)
 */
export const parseReceiptText = (text: string): ParsedReceiptInfo => {
  console.log('========== INICIO PARSING OCR ==========');
  console.log(`Texto completo recibido (${text.length} caracteres):`);
  console.log(text);
  console.log('========================================');

  const lines = text.split('\n');
  console.log(`\nTotal de líneas detectadas: ${lines.length}`);

  // Extract merchant
  console.log('\n--- BUSCANDO MERCHANT ---');
  const merchant = findMerchant(lines);
  console.log(`Merchant final: ${merchant || 'NO ENCONTRADO'}`);

  // Extract date
  console.log('\n--- BUSCANDO FECHA ---');
  const purchaseDate = findDate(text);
  console.log(`Fecha encontrada: ${purchaseDate || 'NO ENCONTRADA'}`);

  // Extract total
  console.log('\n--- BUSCANDO TOTAL ---');
  const total = findTotal(lines);
  console.log(`Total: ${total ? '€' + total : 'NO ENCONTRADO'}`);

  // Extract items
  console.log('\n--- BUSCANDO ITEMS ---');
  const { items, unrecognizedLines } = parseItems(lines, merchant);
  console.log(`Items encontrados: ${items.length}`);
  console.log(`Líneas no reconocidas: ${unrecognizedLines.length}`);

  console.log('\n========== RESUMEN PARSING ==========');
  console.log(`Merchant: ${merchant}`);
  console.log(`Fecha: ${purchaseDate}`);
  console.log(`Total: €${total}`);
  console.log(`Items: ${items.length}`);
  items.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item.name} - €${item.price}`);
  });
  console.log('=====================================\n');

  return {
    items,
    merchant,
    purchaseDate,
    total,
    currency: 'EUR',
    unrecognizedLines,
  };
};

/**
 * Find merchant/store name from receipt
 */
const findMerchant = (lines: string[]): string | null => {
  const merchantLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes('center') ||
      lower.includes('rewe') ||
      lower.includes('edeka') ||
      lower.includes('ahorra') ||
      lower.includes('ahorramas') ||
      lower.includes('mercadona') ||
      lower.includes('carrefour') ||
      lower.includes('lidl') ||
      lower.includes('aldi') ||
      lower.includes('dia') ||
      lower.includes('netto') ||
      line.includes('Str.') ||
      line.includes('Damm') ||
      lower.includes('kaiserin')
    );
  });

  const merchantLine =
    merchantLines.sort((a, b) => b.trim().length - a.trim().length)[0] || null;

  return merchantLine ? merchantLine.trim() : null;
};

/**
 * Find purchase date from receipt
 */
const findDate = (text: string): string | null => {
  // Pattern: DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY or YYYY-MM-DD
  const dateRegex = /(\d{2}[./-]\d{2}[./-]\d{4})|(\d{4}-\d{2}-\d{2})/;
  const match = dateRegex.exec(text);

  if (match) {
    return match[0].substring(0, 10);
  }

  return null;
};

/**
 * Find total amount from receipt
 */
const findTotal = (lines: string[]): number | null => {
  let maxTotal: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].trim().toUpperCase();
    const isTotalLine =
      upper.startsWith('SUMME') ||
      upper.startsWith('TOTAL') ||
      upper.includes('GESAMT');

    if (!isTotalLine) continue;

    // Check same line for amount
    const sameLineMatch = /(\d+)[,.](\d{2})/.exec(lines[i]);
    if (sameLineMatch) {
      const amount = parseFloat(`${sameLineMatch[1]}.${sameLineMatch[2]}`);
      if (amount > 0 && (!maxTotal || amount > maxTotal)) {
        console.log(`✓ Total candidato en línea ${i}: '${lines[i].trim()}' → €${amount}`);
        maxTotal = amount;
      }
    }

    // Check next few lines for amount
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const amountMatch = /^(\d+)[,.](\d{2})$/.exec(lines[j].trim());
      if (amountMatch) {
        const amount = parseFloat(`${amountMatch[1]}.${amountMatch[2]}`);
        if (amount > 0 && (!maxTotal || amount > maxTotal)) {
          console.log(`✓ Total candidato en línea ${j}: '${lines[j].trim()}' → €${amount}`);
          maxTotal = amount;
        }
      }
    }
  }

  if (maxTotal) {
    console.log(`✓ Total final (máximo): €${maxTotal}`);
  }

  return maxTotal;
};

/**
 * Parse items from receipt lines
 */
const parseItems = (
  lines: string[],
  merchant: string | null
): { items: ParsedItem[]; unrecognizedLines: string[] } => {
  const items: ParsedItem[] = [];
  const unrecognizedLines: string[] = [];

  // Temporary storage for E-Center format (separate name and price lines)
  const productNames: string[] = [];
  const productPrices: number[] = [];

  // Patterns
  const namePattern = /^([A-ZÄÖÜ&][A-ZÄÖÜa-zäöü&.\s-]+)$/;
  const pricePatternA = /^(\d+),(\d{2})\s+A$/; // E-Center: "X,XX A"
  const pricePatternB = /^(\d+),?\s*(\d{2})\s+B$/; // Kaiserin-Augusta: "X,XX B"
  const weightPattern = /^\s*(\d+),?\s*(\d+)\s*kg\s*x\s*(\d+),(\d{2})\s*EUR\/kg/; // Weight-based items

  // Inline item pattern (name + price on same line)
  const inlinePattern = /^(.+?)\s+(\d+)[,.](\d{2})\s*€?$/;

  // Quantity + item name pattern (e.g., "3 GO BIO TOMATEN")
  const quantityItemPattern = /^(\d+)\s+([A-ZÄÖÜ][A-ZÄÖÜa-zäöü&.\s-]+)$/;
  // Unit price pattern (e.g., "á 2,09" or "á 2,09     6,27")
  const unitPricePattern = /^á\s*(\d+)[,.](\d{2})(?:\s+(\d+)[,.](\d{2}))?$/;
  // Name with specification pattern (e.g., "H-MILCH 1,5%")
  const nameWithSpecPattern = /^([A-ZÄÖÜ&][A-ZÄÖÜa-zäöü&.\s-]+\d+[,.]\d+%?)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (merchant && line.toLowerCase() === merchant.toLowerCase()) {
      console.log('  IGNORADA (merchant)');
      i++;
      continue;
    }
    console.log(`\nLinea ${i}: '${line}'`);

    // Skip empty lines and metadata
    if (shouldSkipLine(line)) {
      console.log('  IGNORADA (metadata)');
      i++;
      continue;
    }

    let matched = false;

    // Try E-Center price pattern (X,XX A)
    const matchPriceA = pricePatternA.exec(line);
    if (matchPriceA) {
      const price = parseFloat(`${matchPriceA[1]}.${matchPriceA[2]}`);
      console.log(`  ✓ PRECIO E-CENTER: €${price}`);
      productPrices.push(price);
      matched = true;
      i++;
      continue;
    }

    // Try Kaiserin-Augusta price pattern (X,XX B)
    const matchPriceB = pricePatternB.exec(line);
    if (matchPriceB) {
      const price = parseFloat(`${matchPriceB[1]}.${matchPriceB[2]}`);
      console.log(`  ✓ PRECIO KAISERIN: €${price}`);
      productPrices.push(price);
      matched = true;
      i++;
      continue;
    }

    // Try inline pattern (name + price on same line)
    const matchInline = inlinePattern.exec(line);
    if (matchInline && !line.includes('SUMME') && !line.includes('TOTAL')) {
      const name = matchInline[1].trim();
      const price = parseFloat(`${matchInline[2]}.${matchInline[3]}`);

      if (name.length > 2 && price > 0 && price < 1000) {
        console.log(`  ✓ ITEM INLINE: '${name}' - €${price}`);
        items.push({
          name,
          quantity: 1,
          price,
        });
        matched = true;
        i++;
        continue;
      }
    }

    // Try quantity + item pattern (e.g., "3 GO BIO TOMATEN")
    const matchQuantityItem = quantityItemPattern.exec(line);
    if (matchQuantityItem && !matched) {
      const quantity = parseInt(matchQuantityItem[1], 10);
      const name = matchQuantityItem[2].trim();
      console.log(`  ? CANTIDAD + NOMBRE DETECTADO: ${quantity}x '${name}'`);

      // Check if next line has unit price info (á X,XX)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        console.log(`    Siguiente línea: '${nextLine}'`);

        const matchUnitPrice = unitPricePattern.exec(nextLine);
        if (matchUnitPrice) {
          const unitPrice = parseFloat(`${matchUnitPrice[1]}.${matchUnitPrice[2]}`);
          // If total price is provided on same line, use it; otherwise calculate it
          const totalPrice = matchUnitPrice[3] && matchUnitPrice[4]
            ? parseFloat(`${matchUnitPrice[3]}.${matchUnitPrice[4]}`)
            : unitPrice * quantity;

          console.log(`  ✓ ITEM CON CANTIDAD`);
          console.log(`    Cantidad: ${quantity}`);
          console.log(`    Precio unitario: €${unitPrice}`);
          console.log(`    Precio total: €${totalPrice}`);

          items.push({
            name: quantity > 1 ? `${name} (${quantity}x)` : name,
            quantity,
            price: totalPrice,
          });
          matched = true;
          i += 2; // Skip name + unit price lines
          continue;
        }
      }
    }

    // Try name pattern (also try name with specifications like "H-MILCH 1,5%")
    const matchName = namePattern.exec(line) || nameWithSpecPattern.exec(line);
    if (matchName && !matched) {
      console.log(`  ? NOMBRE DETECTADO: '${matchName[1]}'`);

      // Check if next line has weight info
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        console.log(`    Siguiente línea: '${nextLine}'`);

        const matchWeight = weightPattern.exec(nextLine);
        if (matchWeight) {
          const weight = parseFloat(`${matchWeight[1]}.${matchWeight[2]}`) || 1.0;
          const pricePerKg = parseFloat(`${matchWeight[3]}.${matchWeight[4]}`);
          const totalPrice = pricePerKg * weight;

          console.log(`  ✓ ITEM CON PESO`);
          console.log(`    Peso: ${weight}kg`);
          console.log(`    Precio/kg: €${pricePerKg}`);
          console.log(`    Precio total: €${totalPrice}`);

          items.push({
            name: `${matchName[1].trim()} (${weight}kg)`,
            quantity: 1,
            price: totalPrice,
          });
          matched = true;
          i += 2; // Skip name + weight lines
          continue;
        }

        if (/\b\d{5}\b/.test(nextLine)) {
          console.log('  IGNORADA (address line)');
          matched = true;
          i++;
          continue;
        }

        // Check if next line is a standalone price (e.g., "2,49")
        const standalonePriceMatch = /^(\d+)[,.](\d{2})$/.exec(nextLine);
        if (standalonePriceMatch) {
          const price = parseFloat(`${standalonePriceMatch[1]}.${standalonePriceMatch[2]}`);
          if (price > 0 && price < 1000) {
            console.log(`  ✓ ITEM CON PRECIO: '${matchName[1].trim()}' - €${price}`);
            items.push({
              name: matchName[1].trim(),
              quantity: 1,
              price,
            });
            matched = true;
            i += 2;
            continue;
          }
        }
      }

      // No weight/price found, save as product name to pair later
      const name = matchName[1].trim();
      const nameLower = name.toLowerCase();
      if (
        name.length > 3 &&
        !nameLower.includes('berlin') &&
        !nameLower.includes('debit') &&
        !nameLower.includes('nr.') &&
        !nameLower.includes('netto') &&
        !nameLower.includes('onlin')
      ) {
        console.log(`  ✓ NOMBRE GUARDADO: '${name}'`);
        productNames.push(name);
        matched = true;
        i++;
        continue;
      }
    }

    // If not matched, add to unrecognized
    if (!matched && line.length > 1) {
      console.log(`  → No reconocida`);
      unrecognizedLines.push(line);
    }

    i++;
  }

  // Pair names with prices for E-Center format
  console.log(`\n--- EMPAREJANDO NOMBRES Y PRECIOS ---`);
  console.log(`Nombres: ${productNames.length}, Precios: ${productPrices.length}`);

  const minLength = Math.min(productNames.length, productPrices.length);
  for (let j = 0; j < minLength; j++) {
    const name = productNames[j];
    const price = productPrices[j];
    console.log(`  ${j + 1}. '${name}' → €${price}`);

    items.push({
      name,
      quantity: 1,
      price,
    });
  }

  if (items.length === 0 && productNames.length > 0 && productPrices.length === 0) {
    productNames.forEach((name) => {
      items.push({
        name,
        quantity: 1,
      });
    });
  }

  return { items, unrecognizedLines };
};

/**
 * Check if line should be skipped (metadata, headers, footers, etc.)
 */
const shouldSkipLine = (line: string): boolean => {
  if (line.length === 0) return true;

  const skipKeywords = [
    'Tel',
    'UID',
    'Steuer',
    'Geg.',
    'TSE-',
    'Zahlung',
    'Beleg',
    'Bitte',
    'Netto',
    'Brutto',
    'Gesamtbetrag',
    'Posten:',
    'SUMME',
    'TOTAL',
    'Visa',
    'Contactless',
    'Datum:',
    'Uhrzeit:',
    'Beleg-Nr',
    'Trace-Nr',
    'Terminal',
    'Pos-Info',
    'AS-',
    'Capt.',
    'AID',
    'EMV-',
    'ProC-Code',
    'Betrag',
    'Bezahlung',
    'erfolgt',
    'aufbewahren',
    'Kundenbeleg',
    'CIF:',
    'IVA',
    'Gracias',
    'TICKET:',
    'TOTAL ENTREGADO',
    'CAMBIO',
    'ATENCION',
    'CLIENTE',
    'CAJA',
    'TIQUE',
    'S.A.',
    'S.L.',
    'NIF',
    'FACTURA',
    'ALBARAN',
    'CALLE',
    'AVENIDA',
    'AVDA',
    'PASEO',
    'PLAZA',
    'C/',
    // German receipt footer/promotional text
    'Noch kein',
    'REWE',
    'Book',
    'anmelden',
    'sammeln',
    'mmeln',
    'Kasse:',
    'Bed.',
    'Bon-Nr',
    'Markt:',
    // Total and payment keywords
    'GESAMT',
    'ERHALTEN',
    'KARTE',
    'K-U-N-D-E',
    'KOPENICK',
    'KÖPENICK',
  ];

  if (skipKeywords.some((keyword) => line.includes(keyword))) {
    return true;
  }

  // Skip time patterns (HH:MM)
  if (/\d{2}:\d{2}/.test(line)) return true;

  // Skip postal code lines with city
  if (/\b\d{5}\b/.test(line) && /[A-Z]/i.test(line)) return true;

  // Skip long numbers (likely IDs)
  if (/^\d{5,}$/.test(line)) return true;

  // Skip separator lines
  if (/^[#*]+/.test(line)) return true;

  // Skip date-only lines (already extracted)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(line)) return true;

  // Skip codes like "AA-123"
  if (/^[A-Z]{2,}-\d/.test(line)) return true;

  // Skip just "EUR"
  if (line === 'EUR') return true;

  return false;
};
