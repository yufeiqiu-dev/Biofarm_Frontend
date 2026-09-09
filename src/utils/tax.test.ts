import { describe, it, expect } from 'vitest';
import { taxRatePercent } from './tax';

/*
 * This rule was wrong in three places independently before it was written down
 * once, so the cases that were actually getting it wrong are the ones pinned.
 */
describe('taxRatePercent', () => {
  it('rates against goods plus shipping, which is what was taxed', () => {
    // 8.75% of (24.99 + 5.99). Dividing by the goods alone gives 10.84%.
    expect(taxRatePercent(2.71, 24.99 + 5.99)).toBe(8.75);
  });

  it('works in cents as well as dollars', () => {
    expect(taxRatePercent(271, 2499 + 599)).toBe(8.75);
  });

  it('has no rate when there is nothing to divide by', () => {
    // Rendered "Tax (Infinity%)" on one page and "Tax (0%)" on another.
    expect(taxRatePercent(1, 0)).toBeNull();
    expect(taxRatePercent(0, 0)).toBeNull();
  });

  it('refuses a rate it cannot compute rather than printing NaN', () => {
    expect(taxRatePercent(Number.NaN, 100)).toBeNull();
    expect(taxRatePercent(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rounds to two places, because it is rendered directly', () => {
    expect(taxRatePercent(1, 3)).toBe(33.33);
  });
});
