import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsPage } from './ProductsPage';
import { renderWithProviders } from '../../test/renderWithProviders';

// A products request that never settles, so the loading state can be inspected.
const getProducts = vi.fn();
vi.mock('../../api/product', () => ({
  getProducts: (...args: unknown[]) => getProducts(...args),
}));

function makeProduct(i: number) {
  return {
    id: `p${i}`,
    cat_id: `CAT-${String(i).padStart(3, '0')}`,
    name: `Product ${i}`,
    description: 'A product.',
    image_urls: [],
    tags: [{ id: 't1', name: 'Standards' }],
    variants: [
      {
        id: `v${i}`,
        catalog_id: `CAT-${i}-50`,
        size_value: 50,
        size_unit: 'ug',
        price: 100,
        stock: 5,
      },
    ],
  };
}

vi.mock('../../api/tag', () => ({
  getTags: vi.fn().mockResolvedValue([
    { id: 't1', name: 'Tool Antibodies' },
    { id: 't2', name: 'Standards' },
  ]),
}));

/**
 * The bug: while the products were in flight the page returned the loading
 * state *instead of itself* - no heading, no tag filters, nothing. The page
 * collapsed to a spinner, which pulled the dark navy footer up onto the screen
 * for the length of the request and dropped it again when the cards arrived.
 *
 * Reported as "0.1 sec of dark loading" on the products page, and confirmed by
 * screenshotting the loading state: 240px of footer on a 962px viewport, a
 * quarter of the window going dark and back.
 */
describe('ProductsPage while its products are loading', () => {
  beforeEach(() => {
    getProducts.mockReturnValue(new Promise(() => {}));
  });

  it('keeps its heading on screen', async () => {
    renderWithProviders(<ProductsPage />);

    expect(screen.getByRole('heading', { name: /all products/i })).toBeInTheDocument();
  });

  it('keeps the tag filters on screen', async () => {
    renderWithProviders(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tool Antibodies' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Standards' })).toBeInTheDocument();
  });
});

describe('ProductsPage paging', () => {
  beforeEach(() => {
    getProducts.mockReset();
  });

  it('shows one page of products rather than the whole catalogue', async () => {
    // Fetching hundreds is fine; rendering hundreds of image-bearing cards at
    // once is not. Paged in the browser because the data is already here.
    getProducts.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeProduct(i)));
    renderWithProviders(<ProductsPage />);

    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument());

    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.queryByText('Product 12')).not.toBeInTheDocument();
    expect(screen.getByText('1–12 of 30')).toBeInTheDocument();
  });

  it('walks to the next page', async () => {
    getProducts.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeProduct(i)));
    renderWithProviders(<ProductsPage />);
    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Product 12')).toBeInTheDocument();
    expect(screen.queryByText('Product 0')).not.toBeInTheDocument();
    expect(screen.getByText('13–24 of 30')).toBeInTheDocument();
  });

  it('hides the controls entirely when everything fits on one page', async () => {
    getProducts.mockResolvedValue(Array.from({ length: 4 }, (_, i) => makeProduct(i)));
    renderWithProviders(<ProductsPage />);
    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('returns to the first page when the filter changes', async () => {
    // Filtering while on page three would otherwise show an empty grid, which
    // reads as "no products" rather than "no page three".
    getProducts.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeProduct(i)));
    renderWithProviders(<ProductsPage />);
    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Product 12')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Standards' }));

    // Back to the top of the filtered list, not stranded past its end.
    await waitFor(() => expect(screen.getByText('Product 0')).toBeInTheDocument());
  });
});
