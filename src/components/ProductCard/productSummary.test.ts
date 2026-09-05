import { describe, it, expect } from 'vitest';
import {
  LOW_STOCK_THRESHOLD,
  formatPriceRange,
  formatSizeRange,
  stockSummary,
} from './productSummary';
import type { ProductVariant } from '../../types/product_type';

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    catalog_id: 'AB-101-50',
    size_value: 50,
    size_unit: 'ug',
    price: 285,
    stock: 10,
    ...overrides,
  };
}

describe('formatPriceRange', () => {
  it('shows the price when there is only one', () => {
    expect(formatPriceRange([variant({ price: 310 })])).toBe('$310.00');
  });

  it('shows the lowest as a "from" price when there are several', () => {
    // The regression: the card used to render variants[0].price flat, so a
    // product sold in two sizes advertised one of them as *the* price.
    expect(
      formatPriceRange([variant({ price: 285 }), variant({ price: 495 })]),
    ).toBe('from $285.00');
  });

  it('does not say "from" when every variant costs the same', () => {
    expect(
      formatPriceRange([variant({ price: 285 }), variant({ price: 285 })]),
    ).toBe('$285.00');
  });

  it('takes the lowest regardless of the order they arrive in', () => {
    expect(
      formatPriceRange([variant({ price: 495 }), variant({ price: 285 })]),
    ).toBe('from $285.00');
  });
});

describe('formatSizeRange', () => {
  it('shows the size when there is only one', () => {
    expect(formatSizeRange([variant({ size_value: 50 })])).toBe('50 ug');
  });

  it('shows a range when the units agree', () => {
    expect(
      formatSizeRange([variant({ size_value: 50 }), variant({ size_value: 100 })]),
    ).toBe('50–100 ug');
  });

  it('counts sizes instead of ranging when the units differ', () => {
    // "50-96 ug" would be a lie for something sold in both ug and tests.
    expect(
      formatSizeRange([
        variant({ size_value: 50, size_unit: 'ug' }),
        variant({ size_value: 96, size_unit: 'tests' }),
      ]),
    ).toBe('2 sizes');
  });
});

describe('stockSummary', () => {
  it('sums across variants', () => {
    expect(stockSummary([variant({ stock: 4 }), variant({ stock: 10 })]).total).toBe(14);
  });

  it('says how many are left when stock is low', () => {
    // A researcher ordering five units needs the number, not a reassurance.
    const summary = stockSummary([variant({ stock: 2 })]);
    expect(summary.label).toBe('2 left');
    expect(summary.tone).toBe('lowStock');
  });

  it('is a plain reassurance when there is plenty', () => {
    const summary = stockSummary([variant({ stock: LOW_STOCK_THRESHOLD + 1 })]);
    expect(summary.label).toBe('In stock');
    expect(summary.tone).toBe('inStock');
  });

  it('reports nothing available across every variant', () => {
    const summary = stockSummary([variant({ stock: 0 }), variant({ stock: 0 })]);
    expect(summary.label).toBe('Out of stock');
    expect(summary.tone).toBe('outOfStock');
    expect(summary.total).toBe(0);
  });

  it('is in stock when only one variant has any', () => {
    expect(stockSummary([variant({ stock: 0 }), variant({ stock: 9 })]).tone).toBe('inStock');
  });

  it('handles a product with no variants at all', () => {
    expect(stockSummary([]).label).toBe('Out of stock');
    expect(formatPriceRange([])).toBe('—');
    expect(formatSizeRange([])).toBe('—');
  });
});
