import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { AdminProductDetailPage } from './AdminProductDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
import { createProduct, updateProduct, deleteImage } from '../../api/admin_product';
import { getProductById } from '../../api/product';

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

function renderEditPage(productId = 'test-id') {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/products/:productId" element={<AdminProductDetailPage />} />
    </Routes>,
    { user: createMockAdminUser(), initialEntries: [`/admin/products/${productId}`] },
  );
}

/** Fills the three required fields so a submit reaches the save path. */
async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText(/product catalog id/i), 'CAT-1');
  await userEvent.type(screen.getByLabelText(/product name/i), 'A product');
  await userEvent.type(screen.getByLabelText(/^description$/i), 'Describes it.');
}

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

  /*
   * The save sequence, which had no coverage at all.
   *
   * It is the most intricate flow in the application - it creates or updates a
   * product, flushes staged image deletions, and uploads pending files against
   * an id that may not have existed when the user pressed Save - and every one
   * of those steps carries a comment explaining a failure it is there to
   * prevent. None of those claims were tested, so nothing stopped a refactor
   * from quietly undoing them.
   */
  describe('saving', () => {
    beforeEach(() => {
      vi.mocked(createProduct).mockResolvedValue({ id: 'new-product-id' } as never);
      vi.mocked(updateProduct).mockResolvedValue({} as never);
      vi.mocked(deleteImage).mockResolvedValue(undefined as never);
      vi.mocked(getProductById).mockResolvedValue({
        id: 'test-id',
        cat_id: 'CAT',
        name: 'Existing Product',
        description: 'A description',
        tags: [],
        image_urls: ['https://cdn.test/products/test-id/a.jpg', 'https://cdn.test/products/test-id/b.jpg'],
        variants: [],
      } as never);
    });

    it('creates the product before anything is uploaded against it', async () => {
      // Ordering is load-bearing: a new product has no id to presign against
      // until it exists.
      renderCreatePage();
      await fillRequiredFields();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));

      await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
      expect(vi.mocked(createProduct).mock.calls[0][0]).toMatchObject({
        cat_id: 'CAT-1',
        name: 'A product',
      });
    });

    it('sends the display order so a reorder is persisted', async () => {
      renderEditPage();
      await screen.findByDisplayValue('Existing Product');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(updateProduct).toHaveBeenCalled());
      const [, payload] = vi.mocked(updateProduct).mock.calls[0];
      expect(payload).toHaveProperty('image_urls');
      expect((payload as { image_urls: string[] }).image_urls).toEqual([
        'https://cdn.test/products/test-id/a.jpg',
        'https://cdn.test/products/test-id/b.jpg',
      ]);
    });

    it('does not delete an image that was never staged for deletion', async () => {
      renderEditPage();
      await screen.findByDisplayValue('Existing Product');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(updateProduct).toHaveBeenCalled());
      expect(deleteImage).not.toHaveBeenCalled();
    });

    it('reports a failed save instead of navigating away from it', async () => {
      vi.mocked(createProduct).mockRejectedValue(new Error('cat_id already exists'));

      renderCreatePage();
      await fillRequiredFields();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));

      expect(await screen.findByText(/cat_id already exists/i)).toBeInTheDocument();
    });

    it('reuses the product created by a failed attempt rather than making a second one', async () => {
      // The retry trap. Without pendingProductId, a save that created the
      // product and then failed while uploading would create another product
      // on the next press - and the first would be left orphaned.
      vi.mocked(createProduct).mockResolvedValue({ id: 'new-product-id' } as never);
      vi.mocked(updateProduct).mockRejectedValueOnce(new Error('network'));

      renderCreatePage();
      await fillRequiredFields();
      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));
      await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));

      await userEvent.click(screen.getByRole('button', { name: 'Create Product' }));

      await waitFor(() => expect(updateProduct).toHaveBeenCalled());
      expect(createProduct).toHaveBeenCalledTimes(1);
    });
  });
});