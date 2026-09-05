import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminProductsPage } from './AdminProductsPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
vi.mock('../../api/admin_product', () => ({
  getAdminProducts: vi.fn().mockResolvedValue([
    {
      id: 'p1',
      cat_id: 'CAT',
      name: 'Product One',
      description: 'A test product',
      image_urls: [],
      tags: [],
      variants: [{ id: 'variant-1', catalog_id: 'CAT-001', size_value: 100, size_unit: 'g', price: 9.99, stock: 50 }],
    },
    {
      id: 'p2',
      cat_id: 'CAT',
      name: 'Product Two',
      description: 'A test product',
      image_urls: [],
      tags: [],
      variants: [{ id: 'variant-1', catalog_id: 'CAT-001', size_value: 100, size_unit: 'g', price: 9.99, stock: 50 }],
    },
  ]),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
}));

describe('AdminProductsPage', () => {
  it('opens ConfirmDialog (not window.confirm) when Delete Selected is clicked', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderWithProviders(<AdminProductsPage />, { user: createMockAdminUser() });

    await waitFor(() => {
      expect(screen.getByText('Product One')).toBeInTheDocument();
    });

    // Select first product by clicking its row
    await userEvent.click(screen.getByText('Product One'));

    await userEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete products')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('keeps products in the list and makes no API call when dialog is cancelled', async () => {
    const { deleteProduct } = await import('../../api/admin_product');
    renderWithProviders(<AdminProductsPage />, { user: createMockAdminUser() });

    await waitFor(() => {
      expect(screen.getByText('Product One')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Product One'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Product One')).toBeInTheDocument();
    expect(deleteProduct).not.toHaveBeenCalled();
  });
});
