import type { Product, ProductVariant } from '../../types/product_type';

export function createMockVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'variant-1',
    catalog_id: 'CAT-001',
    size_value: 100,
    size_unit: 'g',
    price: 9.99,
    stock: 50,
    ...overrides,
  };
}

export function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    cat_id: 'CAT',
    name: 'Test Product',
    description: 'A test product',
    image_urls: [],
    tags: [],
    variants: [createMockVariant()],
    ...overrides,
  };
}
