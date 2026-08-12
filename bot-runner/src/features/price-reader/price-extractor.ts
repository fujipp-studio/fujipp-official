/**
 * Extracts Discord Shop prices from OCR text and looks up the shop selling
 * price from a configurable price map.
 */

// ── Public types ────────────────────────────────────────────────────────────

export interface PriceResult {
  /** Current checkout price, preferring the lowest visible THB value. */
  currentPriceSatang: number | null;
  /** Original (non-Nitro) price in satang, or null when undetected. */
  originalPriceSatang: number | null;
  /** Nitro-discounted price in satang, or null when undetected. */
  nitroPriceSatang: number | null;
  /** Discount percentage shown in the screenshot, or null. */
  discountPercent: number | null;
  /** Item name extracted from the text, or null. */
  itemName: string | null;
}

/** A single entry in the price map: Discord price → shop price. */
export interface PriceEntry {
  /** Discord selling price in satang (e.g. 20900 = 209 บาท). */
  discordPriceSatang: number;
  /** Shop selling price in satang (e.g. 4500 = 45 บาท). */
  shopPriceSatang: number;
}

// ── Price extraction ────────────────────────────────────────────────────────

/**
 * Parses raw OCR text from a Discord Shop screenshot and returns structured
 * price information.
 *
 * Discord Shop screenshots typically contain patterns like:
 *   "THB 739.00"
 *   "ใช้ Nitro ในราคา THB 589.00"
 *   "-35%"  or  "ลด 35%"
 *   Item name on the first prominent line
 */
export function extractPrices(ocrText: string): PriceResult {
  const text = normaliseOcrText(ocrText);

  const nitroPriceSatang = extractNitroPrice(text);
  const originalPriceSatang = extractOriginalPrice(text, nitroPriceSatang);
  const currentPriceSatang = extractCurrentPrice(text)
    ?? nitroPriceSatang
    ?? originalPriceSatang;
  const discountPercent = extractDiscount(text);
  const itemName = extractItemName(text);

  return { currentPriceSatang, originalPriceSatang, nitroPriceSatang, discountPercent, itemName };
}

/**
 * Version 2 price selection. Nitro membership prices are retained only as
 * metadata; the amount used for the shop lookup comes from the normal price or
 * the Discord purchase button.
 */
export function extractStandardPrices(ocrText: string): PriceResult {
  const text = normaliseOcrText(ocrText);
  const nitroPriceSatang = extractNitroPrice(text);
  const standardPriceSatang = extractPurchaseButtonPrice(text)
    ?? extractNonNitroCurrencyPrice(text)
    ?? extractDiscountedLinePrice(withoutNitroLines(text));
  const discountPercent = extractDiscount(text);
  const itemName = extractItemName(text);

  return {
    currentPriceSatang: standardPriceSatang,
    originalPriceSatang: standardPriceSatang,
    nitroPriceSatang,
    discountPercent,
    itemName,
  };
}

// ── Price map lookup ────────────────────────────────────────────────────────

/** Tolerance when matching OCR-read prices to the price map (±5 บาท). */
const MATCH_TOLERANCE_SATANG = 500;

/**
 * Finds the shop price for the given Discord price by looking up the closest
 * entry in the price map (within a ±5 บาท tolerance to account for OCR
 * inaccuracies).
 *
 * Returns the shop price in satang, or `null` when no match is found.
 */
export function lookupShopPrice(
  discordPriceSatang: number,
  priceMap: PriceEntry[],
): number | null {
  let bestMatch: PriceEntry | null = null;
  let bestDistance = Infinity;

  for (const entry of priceMap) {
    const distance = Math.abs(entry.discordPriceSatang - discordPriceSatang);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestDistance <= MATCH_TOLERANCE_SATANG) {
    return bestMatch.shopPriceSatang;
  }
  return null;
}

// ── Config helpers ──────────────────────────────────────────────────────────

/**
 * Reads and validates the price map array from the runtime config value.
 *
 * Expected format:
 * ```json
 * [
 *   { "discordPrice": 209, "shopPrice": 45 },
 *   { "discordPrice": 250, "shopPrice": 55 },
 *   ...
 * ]
 * ```
 *
 * Values can be in baht (auto-converted to satang) or already in satang.
 */
export function readPriceMap(value: unknown): PriceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    // Support both baht and satang input formats.
    const discord = resolveAmount(item.discordPriceSatang, item.discordPrice);
    const shop = resolveAmount(item.shopPriceSatang, item.shopPrice);
    if (discord === null || shop === null) return [];
    if (discord <= 0 || shop < 0) return [];
    return [{ discordPriceSatang: discord, shopPriceSatang: shop }];
  });
}

/** Resolve an amount that may be in satang or baht. */
function resolveAmount(satangValue: unknown, bahtValue: unknown): number | null {
  if (typeof satangValue === "number" && Number.isFinite(satangValue)) {
    return Math.round(satangValue);
  }
  if (typeof bahtValue === "number" && Number.isFinite(bahtValue)) {
    return Math.round(bahtValue * 100);
  }
  return null;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Normalise whitespace and common OCR artefacts. */
function normaliseOcrText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[""]/g, "\"")
    .replace(/['']/g, "'")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * Extracts the Nitro price from patterns like:
 *   "ใช้ Nitro ในราคา THB 589.00"
 *   "Nitro ในราคา THB 589.00"
 *   "Nitro THB 589.00"
 *   "ในราคา THB 589"
 */
function extractNitroPrice(text: string): number | null {
  const nitroPatterns = [
    /(?:ใช้\s*)?[Nn]itro\s+ในราคา\s*(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/,
    /ในราคา\s*(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/,
    /[Nn]itro\s*(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/,
  ];
  for (const pattern of nitroPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseTHB(match[1]);
  }
  return null;
}

/**
 * Extracts the original (full) price from patterns like:
 *   "THB 739.00"
 *   "฿ 739"
 * Skips the value that was already identified as the Nitro price.
 */
function extractOriginalPrice(text: string, nitroPriceSatang: number | null): number | null {
  const pattern = /(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/g;
  let match: RegExpExecArray | null;
  const prices: number[] = [];

  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      const satang = parseTHB(match[1]);
      if (satang !== null && satang > 0) prices.push(satang);
    }
  }

  if (prices.length === 0) {
    return extractOcrCurrencyPrice(text) ?? extractDiscountedLinePrice(text);
  }

  // If we already found a Nitro price, the original price is the *other*
  // (typically higher) THB value.
  if (nitroPriceSatang !== null) {
    const others = prices.filter((p) => p !== nitroPriceSatang);
    if (others.length > 0) return Math.max(...others);
  }

  // Otherwise the highest value is most likely the original price.
  return Math.max(...prices);
}

/**
 * Returns the amount the buyer actually pays. Discord renders the crossed-out
 * original price before the discounted price, so the lowest visible currency
 * amount is the useful value for the shop rate lookup.
 */
function extractCurrentPrice(text: string): number | null {
  const pattern = /(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/g;
  const prices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (!match[1]) continue;
    const price = parseTHB(match[1]);
    if (price !== null) prices.push(price);
  }
  return prices.length > 0 ? Math.min(...prices) : extractOcrCurrencyPrice(text);
}

/**
 * Recovers prices when Tesseract mistakes Discord's small baht glyph for
 * `B`/`8`, or drops it after the Thai "ซื้อในราคา" label. Typical OCR output
 * from a shop card is `8250` and `ซื้อในราคา 8250.00`; both mean ฿250.
 *
 * The bare `8` form is intentionally limited to a price label or a line that
 * contains only the amount, so unrelated numbers in item names are ignored.
 */
function extractOcrCurrencyPrice(text: string): number | null {
  const patterns = [
    /(?:ซ[ื้]*อ\s*)?ในราคา\s*[B8]\s*(\d{2,5}(?:\.\d{1,2})?)/i,
    /(?:^|\n)\s*[B8]\s*(\d{2,5}(?:\.\d{1,2})?)\s*(?=\n|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseTHB(match[1]);
  }
  return null;
}

/** Prefers the explicit normal checkout call-to-action when OCR captures it. */
function extractPurchaseButtonPrice(text: string): number | null {
  const patterns = [
    /(?:ซ[ื้]*อ|buy)(?:\s*ในราคา)?[^\n]{0,30}?(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:ซ[ื้]*อ|buy)(?:\s*ในราคา)?\s*[B8]\s*(\d{2,5}(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseTHB(match[1]);
  }
  return null;
}

/** Finds visible THB amounts while excluding any line advertising Nitro. */
function extractNonNitroCurrencyPrice(text: string): number | null {
  const standardText = withoutNitroLines(text);
  const pattern = /(?:THB|฿)\s*([\d,]+(?:\.\d{1,2})?)/g;
  const prices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(standardText)) !== null) {
    if (!match[1]) continue;
    const price = parseTHB(match[1]);
    if (price !== null) prices.push(price);
  }
  if (prices.length === 0) return null;
  const counts = new Map<number, number>();
  for (const price of prices) counts.set(price, (counts.get(price) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

function withoutNitroLines(text: string): string {
  return text.split("\n").filter((line) => !/Nitro/i.test(line)).join("\n");
}

/**
 * Discord's small baht glyph is commonly recognised as `@`, `8`, or omitted.
 * A price immediately followed by a parenthesised discount is sufficiently
 * specific to recover without treating unrelated numbers as prices.
 */
function extractDiscountedLinePrice(text: string): number | null {
  const suffix = String.raw`\s*\(\s*[-–]\s*\d{1,3}\s*%\s*\)`;
  const patterns = [
    new RegExp(String.raw`(?:฿|@)\s*(\d{2,5}(?:\.\d{1,2})?)${suffix}`),
    new RegExp(String.raw`(?:^|\s)8(\d{2,3}(?:\.\d{1,2})?)${suffix}`),
    new RegExp(String.raw`(?:^|\s)(\d{2,5}(?:\.\d{1,2})?)${suffix}`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseTHB(match[1]);
  }
  return null;
}

/** Extracts a discount percentage such as "-35%" or "ลด 35%". */
function extractDiscount(text: string): number | null {
  const match = text.match(/[-–]\s*(\d{1,3})\s*%/) ?? text.match(/ลด\s*(\d{1,3})\s*%/);
  if (!match?.[1]) return null;
  const percent = Number(match[1]);
  return percent > 0 && percent < 100 ? percent : null;
}

/** Best-effort item name: first non-trivial line that is not a price line. */
function extractItemName(text: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^[\d\s,.%฿$THB]+$/.test(line)) continue;
    if (line.length < 3) continue;
    if (/(?:THB|฿|Nitro|ในราคา|ลด\s*\d|ซื้อ|สมัคร)/i.test(line)) continue;
    return line.length > 80 ? line.slice(0, 80) : line;
  }
  return null;
}

/** Converts a Thai-Baht string like "739.00" or "1,200" to satang. */
function parseTHB(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
