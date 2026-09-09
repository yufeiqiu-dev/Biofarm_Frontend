import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDetailPage } from './ProductDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { Product } from '../../types/product_type';

const twoSizes: Product = {
  id: 'p1',
  cat_id: 'AB-101',
  name: 'Anti-Tau (pS396) Monoclonal Antibody',
  description: 'Mouse monoclonal raised against human tau phosphorylated at Ser396.',
  tags: [{ id: 't1', name: 'Tool Antibodies' }],
  image_urls: [],
  variants: [
    { id: 'v1', catalog_id: 'AB-101-50', size_value: 50, size_unit: 'ug', price: 285, stock: 14 },
    { id: 'v2', catalog_id: 'AB-101-100', size_value: 100, size_unit: 'ug', price: 495, stock: 3 },
  ],
};

const oneSize: Product = {
  ...twoSizes,
  id: 'p2',
  cat_id: 'AB-118',
  name: 'Anti-Alpha-Synuclein Polyclonal Antibody',
  variants: [
    { id: 'v9', catalog_id: 'AB-118-50', size_value: 50, size_unit: 'ug', price: 310, stock: 12 },
  ],
};

import { ApiError } from '../../api/client';

const getProductById = vi.fn();
vi.mock('../../api/product', () => ({
  getProductById: (id: string) => getProductById(id),
}));

// Mutable, so a test can move between products the way the cart sidebar's
// links do - which is what surfaced state surviving a param change.
let currentProductId = 'p1';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ productId: currentProductId }) };
});

describe('ProductDetailPage', () => {
  it('shows the catalog ID, which the page did not render at all', async () => {
    // The product's real name - what gets searched, written into a Methods
    // section and quoted to a supplier - was missing from its own page.
    currentProductId = 'p1';
    getProductById.mockResolvedValue(twoSizes);
    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByText('AB-101')).toBeInTheDocument();
  });

  it('shows the tags, which were fetched and never displayed', async () => {
    getProductById.mockResolvedValue(twoSizes);
    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByRole('link', { name: 'Tool Antibodies' })).toBeInTheDocument();
  });

  it('gives the count for a low-stock size rather than just "Available"', async () => {
    // The old page said "Available" whatever the number. Someone ordering five
    // needs to know there are three.
    getProductById.mockResolvedValue(twoSizes);
    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByText('3 left')).toBeInTheDocument();
  });

  it('shows both ends of the price range above the fold', async () => {
    getProductById.mockResolvedValue(twoSizes);
    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByText('$285.00 – $495.00')).toBeInTheDocument();
  });

  it('switches the buy panel when another size is chosen', async () => {
    getProductById.mockResolvedValue(twoSizes);
    const { container } = renderWithProviders(<ProductDetailPage />);

    await screen.findByText('AB-101');

    // Scoped to the panel deliberately: every price also appears in the table,
    // so an unscoped query passes whether or not the panel actually changed.
    const panel = () => within(container.querySelector('dl') as HTMLElement);

    expect(panel().getByText('AB-101-50')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('radio')[1]);

    await waitFor(() => {
      expect(panel().getByText('AB-101-100')).toBeInTheDocument();
    });
    expect(panel().getByText('100 ug')).toBeInTheDocument();
  });

  it('offers the sizes as radios, so the table works from the keyboard', async () => {
    // Clickable table rows are not reachable by keyboard; radios are, and they
    // announce the rows as a choice rather than as data.
    getProductById.mockResolvedValue(twoSizes);
    renderWithProviders(<ProductDetailPage />);

    await screen.findByText('AB-101');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('does not print a one-row table above a panel saying the same thing', async () => {
    // With a single variant the table and the buy panel carried identical size,
    // price and stock - the page telling you twice.
    getProductById.mockResolvedValue(oneSize);
    renderWithProviders(<ProductDetailPage />);

    await screen.findByText('AB-118');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('AB-118-50')).toBeInTheDocument();
  });

  it('does not report an outage as a missing product', async () => {
    /*
     * Every failure used to collapse into setProduct(null), which renders
     * "Product not found." So a backend that was down said, confidently and
     * wrongly, that the product had been deleted - on every product page, and
     * indistinguishable from a real 404 in a customer's bug report.
     */
    getProductById.mockRejectedValue(new ApiError('Internal Server Error', 500));

    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByText(/fault on our side/i)).toBeInTheDocument();
    expect(screen.queryByText(/product not found/i)).not.toBeInTheDocument();
  });

  it('does not carry one page’s outage onto the next product', async () => {
    /*
     * React Router keeps this component mounted across /products/:id changes,
     * so a flag set on failure survived the navigation: one transient 500 left
     * every product opened afterwards claiming the fault was ours. The cart
     * sidebar links straight to other products, so it is one click away.
     */
    currentProductId = 'p1';
    getProductById.mockRejectedValueOnce(new ApiError('Internal Server Error', 500));
    const { rerender } = renderWithProviders(<ProductDetailPage />);
    await screen.findByText(/fault on our side/i);

    // One click through the cart sidebar to another product, which loads fine.
    currentProductId = 'p2';
    getProductById.mockResolvedValue(twoSizes);
    rerender(<ProductDetailPage />);

    expect(await screen.findByText(twoSizes.name)).toBeInTheDocument();
    expect(screen.queryByText(/fault on our side/i)).not.toBeInTheDocument();
  });

  it('ignores an answer from a product already navigated away from', async () => {
    /*
     * Clearing the flag as each load starts fixes the sequential case but not
     * the overlapping one: click A then B straight away, B clears the flag and
     * starts its fetch, and A's request then 500s onto B's page - a fault
     * message over a product that loaded perfectly.
     */
    let failA: (error: Error) => void = () => {};
    getProductById.mockReturnValueOnce(new Promise((_r, reject) => { failA = reject; }));
    currentProductId = 'p1';
    const { rerender } = renderWithProviders(<ProductDetailPage />);

    // Straight on to another product, before A has answered.
    currentProductId = 'p2';
    getProductById.mockResolvedValue(twoSizes);
    rerender(<ProductDetailPage />);
    await screen.findByText(twoSizes.name);

    // A's failure lands now, and belongs to a page nobody is looking at.
    failA(new ApiError('Internal Server Error', 500));

    expect(await screen.findByText(twoSizes.name)).toBeInTheDocument();
    expect(screen.queryByText(/fault on our side/i)).not.toBeInTheDocument();
  });

  it('still says not found when the product really is gone', async () => {
    getProductById.mockRejectedValue(new ApiError('Not Found', 404));

    renderWithProviders(<ProductDetailPage />);

    expect(await screen.findByText(/product not found/i)).toBeInTheDocument();
  });
});
