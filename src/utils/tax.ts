/**
 * The tax rate to show beside a tax amount.
 *
 * Written once because it was wrong in three places independently, and each was
 * found separately: the checkout Payment step, the post-purchase receipt and
 * the order detail page each divided by the goods subtotal alone.
 *
 * The tax is levied on goods **plus shipping** - `calculate_tax` passes the
 * shipping cost to Stripe Tax because most US states tax delivery - so the
 * goods-only denominator overstates the rate. $24.99 of goods with $5.99
 * shipping at 8.75% rendered "10.84%", and the customer saw one rate on the
 * screen where they entered their card and a different one on the receipt a
 * click later.
 *
 * Returns null rather than a number when there is nothing to divide by, so
 * callers drop the parenthetical instead of printing "(0%)" or, as one page
 * managed on a zero-subtotal order, "(Infinity%)".
 *
 * Unit-agnostic: pass cents and cents, or dollars and dollars.
 */
export function taxRatePercent(tax: number, taxable: number): number | null {
  if (!(taxable > 0) || !Number.isFinite(tax) || !Number.isFinite(taxable)) return null;
  return parseFloat(((tax / taxable) * 100).toFixed(2));
}
