import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { AdminProductDetailPage } from './AdminProductDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';

vi.mock('../../api/admin_tag', () => ({
  getAdminTags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../api/admin_product', () => ({
  createProduct: vi.fn().mockResolvedValue({ id: 'new-product-id' }),
  updateProduct: vi.fn().mockResolvedValue({}),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  getImagePresignedUrl: vi.fn(),
  confirmImageUpload: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock('../../api/product', () => ({
  getProductById: vi.fn().mockResolvedValue({
    id: 'test-id',
    cat_id: 'CAT',
    name: 'Existing Product',
    description: 'A description',
    tags: [],
    image_urls: [],
    variants: [],
  }),
}));

function renderCreatePage() {
  return renderWithProviders(<AdminProductDetailPage />, {
    user: createMockAdminUser(),
    initialEntries: ['/admin/products/new'],
  });
}

describe('AdminProductDetailPage', () => {
  describe('form validation — create mode', () => {
    it('shows inline error for cat_id when submitted empty', async () => {
      renderCreatePage();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));
      expect(await screen.findByText('Product catalog ID is required.')).toBeInTheDocument();
    });

    it('shows inline errors for name and description when submitted empty', async () => {
      renderCreatePage();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));
      expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
      expect(screen.getByText('Product description is required.')).toBeInTheDocument();
    });

    it('clears only the corrected field error on input, leaving others', async () => {
      renderCreatePage();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));

      expect(await screen.findByText('Product catalog ID is required.')).toBeInTheDocument();
      expect(screen.getByText('Product name is required.')).toBeInTheDocument();

      await userEvent.type(
        screen.getByPlaceholderText('Enter base product catalog ID'),
        'CAT-001'
      );

      expect(screen.queryByText('Product catalog ID is required.')).not.toBeInTheDocument();
      expect(screen.getByText('Product name is required.')).toBeInTheDocument();
    });

    it('shows per-variant inline errors when a variant is added and submitted empty', async () => {
      renderCreatePage();
      await userEvent.click(screen.getByRole('button', { name: 'Add Variant' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));
      expect(await screen.findByText('Catalog ID is required.')).toBeInTheDocument();
      expect(screen.getByText('Size value is required.')).toBeInTheDocument();
    });

    it('removes variant error messages when the variant is removed', async () => {
      renderCreatePage();
      await userEvent.click(screen.getByRole('button', { name: 'Add Variant' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));
      expect(await screen.findByText('Catalog ID is required.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(screen.queryByText('Catalog ID is required.')).not.toBeInTheDocument();
    });
  });

  describe('delete confirmation — edit mode', () => {
    it('opens ConfirmDialog (not window.confirm) when Delete Product is clicked', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');

      renderWithProviders(
        <Routes>
          <Route path="/admin/products/:productId" element={<AdminProductDetailPage />} />
        </Routes>,
        {
          user: createMockAdminUser(),
          initialEntries: ['/admin/products/test-id'],
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete Product' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Delete Product' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete product')).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });
});
