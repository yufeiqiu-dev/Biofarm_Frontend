import type { ProductVariant } from "../../types/product_type";

/**
 * Summarising a product's variants for a listing.
 *
 * Kept apart from the component so the rules are testable on their own - these
 * are the lines a buyer scans, and getting them wrong is quietly misleading
 * rather than visibly broken.
 */

export type StockTone = "inStock" | "lowStock" | "outOfStock";

/** Below this, say how many are left rather than just "in stock". */
export const LOW_STOCK_THRESHOLD = 5;

export function formatPriceRange(variants: ProductVariant[]): string {
  if (variants.length === 0) return "—";

  const prices = variants.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  // "from" matters. The old card showed variants[0].price flat, so a product
  // sold in two sizes advertised one of them as the price.
  return low === high ? `$${low.toFixed(2)}` : `from $${low.toFixed(2)}`;
}

export function formatSizeRange(variants: ProductVariant[]): string {
  if (variants.length === 0) return "—";

  const unit = variants[0].size_unit;
  const sizes = variants.map((v) => v.size_value);
  const low = Math.min(...sizes);
  const high = Math.max(...sizes);

  // Only collapse to a range when the units agree; "50-96 ug" would be a lie
  // for a product sold in both µg and tests.
  const mixedUnits = variants.some((v) => v.size_unit !== unit);
  if (mixedUnits) return `${variants.length} sizes`;

  return low === high ? `${low} ${unit}` : `${low}–${high} ${unit}`;
}

export function stockSummary(variants: ProductVariant[]): {
  total: number;
  label: string;
  tone: StockTone;
} {
  const total = variants.reduce((sum, v) => sum + v.stock, 0);

  if (total === 0) return { total, label: "Out of stock", tone: "outOfStock" };

  // A researcher ordering five units needs the number, not a reassurance.
  if (total <= LOW_STOCK_THRESHOLD) {
    return { total, label: `${total} left`, tone: "lowStock" };
  }

  return { total, label: "In stock", tone: "inStock" };
}

/**
 * Both ends of the range, for the product page.
 *
 * formatPriceRange says "from $285.00", which is the right summary when you are
 * scanning a listing and comparing products. On a product page the variant
 * table below lists every price anyway, so the header should say what the range
 * actually is rather than only where it starts.
 */
export function formatPriceSpan(variants: ProductVariant[]): string {
  if (variants.length === 0) return "—";

  const prices = variants.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  if (low === high) return `$${low.toFixed(2)}`;
  return `$${low.toFixed(2)} – $${high.toFixed(2)}`;
}

/**
 * Availability for a single variant.
 *
 * stockSummary answers "can this product be bought at all", by summing every
 * variant - the question a listing row asks. On the product page the question
 * is "how many of this size are there", which is per row, and a product with
 * 20 of one size and none of another must not report the second as in stock.
 *
 * Shares LOW_STOCK_THRESHOLD so the listing and the product page can never
 * disagree about what counts as low.
 */
export function variantStock(stock: number): { label: string; tone: StockTone } {
  if (stock <= 0) return { label: "Out of stock", tone: "outOfStock" };
  if (stock <= LOW_STOCK_THRESHOLD) return { label: `${stock} left`, tone: "lowStock" };
  return { label: "In stock", tone: "inStock" };
}
