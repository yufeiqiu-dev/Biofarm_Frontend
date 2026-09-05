import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ProductsPage } from './ProductsPage';
import { renderWithProviders } from '../../test/renderWithProviders';

// A products request that never settles, so the loading state can be inspected.
vi.mock('../../api/product', () => ({
  getProducts: vi.fn().mockReturnValue(new Promise(() => {})),
}));

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
