import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { AdminProductDetailPage } from './AdminProductDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
import {
  adjustVariantStock,
  createProduct,
  updateProduct,
  deleteImage,
} from '../../api/admin_product';
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
  adjustVariantStock: vi.fn(),
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
/*
 * Stock is adjusted, never overwritten.
 *
 * It used to be an ordinary field on this form, which is a read-modify-write
 * over a whole product: the page reads every field, the admin edits one, and it
 * writes them all back. The count in that payload was read before they started
 * typing, so every sale made while the page was open was silently reverted -
 * proven against Postgres as shelf 4, customer buys 2, admin edits only the
 * price, system says 4 and the shelf holds 2.
 */
describe('AdminProductDetailPage stock', () => {
  const withVariant = {
    id: 'test-id',
    cat_id: 'CAT',
    name: 'Existing Product',
    description: 'A description',
    tags: [],
    image_urls: [],
    variants: [
      { id: 'v1', catalog_id: 'CAT-A', size_value: 50, size_unit: 'ug', price: 285, stock: 4 },
    ],
  };

  beforeEach(() => {
    vi.mocked(getProductById).mockResolvedValue(withVariant as never);
    vi.mocked(adjustVariantStock).mockReset();
    vi.mocked(updateProduct).mockClear();
  });

  async function openAdjustDialog() {
    renderEditPage();
    await screen.findByText('4');
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
  }

  it('shows the count as a fact, not as something to type over', async () => {
    renderEditPage();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('4')).not.toBeInTheDocument();
  });

  it('does not send stock when the product is saved', async () => {
    // The server rejects it on an existing variant, and this is why: the
    // payload was read before the admin started typing.
    renderEditPage();
    await screen.findByText('4');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(vi.mocked(updateProduct)).toHaveBeenCalled());
    const payload = vi.mocked(updateProduct).mock.calls[0][1];
    expect(payload.variants![0]).not.toHaveProperty('stock');
  });

  it('sends a change rather than a new value', async () => {
    vi.mocked(adjustVariantStock).mockResolvedValue({ stock: 16 } as never);
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '12');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() =>
      expect(vi.mocked(adjustVariantStock)).toHaveBeenCalledWith('test-id', 'v1', 12, ''),
    );
  });

  it('shows the count the server came back with, not ours plus the delta', async () => {
    // A sale landed while the page was open, so the server applied the delivery
    // to 2 rather than the 4 on screen. Trusting our own arithmetic here would
    // put the stale number straight back.
    vi.mocked(adjustVariantStock).mockResolvedValue({ stock: 14 } as never);
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '12');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText('14')).toBeInTheDocument();
    expect(screen.queryByText('16')).not.toBeInTheDocument();
  });

  it('accepts a negative adjustment for breakage', async () => {
    vi.mocked(adjustVariantStock).mockResolvedValue({ stock: 1 } as never);
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-3');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() =>
      expect(vi.mocked(adjustVariantStock)).toHaveBeenCalledWith('test-id', 'v1', -3, ''),
    );
  });

  it('refuses an empty or zero adjustment without calling the server', async () => {
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '0');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText(/enter a whole number of units/i)).toBeInTheDocument();
    expect(vi.mocked(adjustVariantStock)).not.toHaveBeenCalled();
  });

  it('sends the reason, so the log records why the count moved', async () => {
    // The server accepted a reason and logged it while nothing ever sent one,
    // so every real adjustment recorded "reason=-" and the audit trail the
    // endpoint was justified by did not exist.
    vi.mocked(adjustVariantStock).mockResolvedValue({ stock: 16 } as never);
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '12');
    await userEvent.type(screen.getByLabelText(/reason/i), 'Delivery 4471');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() =>
      expect(vi.mocked(adjustVariantStock)).toHaveBeenCalledWith(
        'test-id', 'v1', 12, 'Delivery 4471',
      ),
    );
  });

  it('does not let the dialog be dismissed mid-request', async () => {
    /*
     * Closing while the request was in flight wrote the rejection into state
     * nothing renders: no error shown, the count unchanged, and the only
     * reasonable conclusion for the admin was that it had worked.
     */
    let reject: (error: Error) => void = () => {};
    vi.mocked(adjustVariantStock).mockReturnValue(
      new Promise((_resolve, r) => { reject = r; }) as never,
    );
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: /cancel/i })).toBeDisabled();
    reject(new Error('Cannot remove 5 from a stock of 2'));
    expect(await screen.findByText(/cannot remove 5/i)).toBeInTheDocument();
  });

  it('announces a refusal rather than leaving the dialog silent', async () => {
    // Blocking dismissal mid-request closed "no feedback, so assume it worked"
    // for a sighted admin. Making the count an <output> then made the success
    // speak, which sharpened the asymmetry: the refusal still said nothing.
    vi.mocked(adjustVariantStock).mockRejectedValue(
      new Error('Cannot remove 5 from a stock of 2'),
    );
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/cannot remove 5/i);
    expect(screen.getByLabelText(/units to add or remove/i)).toHaveAttribute(
      'aria-describedby',
      'restock-error',
    );
  });

  it('writes the new count onto the variant it adjusted, not the row it was in', async () => {
    // The dialog is aria-modal but the page behind it is not inert, so a
    // keyboard user can tab out, remove a variant above this one, and tab back.
    // Matching by index then lands the count on a different variant.
    vi.mocked(getProductById).mockResolvedValue({
      ...withVariant,
      variants: [
        { id: 'v0', catalog_id: 'CAT-Z', size_value: 10, size_unit: 'ug', price: 5, stock: 99 },
        withVariant.variants[0],
      ],
    } as never);
    vi.mocked(adjustVariantStock).mockResolvedValue({ stock: 14 } as never);
    renderEditPage();
    await screen.findByText('4');

    await userEvent.click(screen.getByRole('button', { name: /adjust stock for CAT-A/i }));
    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '12');

    // The variant above is removed while the dialog is open, so CAT-A is no
    // longer at the index the dialog recorded.
    await userEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText('14')).toBeInTheDocument();
    expect(screen.queryByText('99'), 'CAT-Z was removed').not.toBeInTheDocument();
  });

  it('cannot be abandoned by switching variants mid-request', async () => {
    /*
     * The dialog disables its own Cancel and backdrop, but the page's other
     * Adjust buttons sit outside it and stay reachable by keyboard. Since the
     * dialog is keyed by variant, pressing one mid-request unmounts the instance
     * waiting for an answer - so the rejection lands on a dead component and is
     * dropped: no error, no change, and every reason to think it worked. That is
     * the same hole the busy guard was added to close.
     */
    vi.mocked(getProductById).mockResolvedValue({
      ...withVariant,
      variants: [
        { id: 'v0', catalog_id: 'CAT-Z', size_value: 10, size_unit: 'ug', price: 5, stock: 99 },
        withVariant.variants[0],
      ],
    } as never);
    let reject: (error: Error) => void = () => {};
    vi.mocked(adjustVariantStock).mockReturnValue(
      new Promise((_resolve, r) => { reject = r; }) as never,
    );
    renderEditPage();
    await screen.findByText('4');

    await userEvent.click(screen.getByRole('button', { name: /adjust stock for CAT-A/i }));
    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    // Every door off the page, not just the dialog's own: leaving unmounts the
    // page and the adjustment's answer is dropped with it.
    expect(screen.getByRole('button', { name: /adjust stock for CAT-Z/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete product/i })).toBeDisabled();

    reject(new Error('Cannot remove 5 from a stock of 2'));
    expect(await screen.findByText(/cannot remove 5/i)).toBeInTheDocument();
  });

  it('does not carry one variant’s attempt onto another', async () => {
    /*
     * The dialog can be switched between variants without closing: the page
     * behind it is not inert and there is no focus trap, so an admin can tab
     * out to another variant's Adjust button and press Enter. Without a key,
     * React reconciles the same instance and the typed delta and the error
     * survive - one click from taking those units off the wrong variant.
     */
    vi.mocked(getProductById).mockResolvedValue({
      ...withVariant,
      variants: [
        { id: 'v0', catalog_id: 'CAT-Z', size_value: 10, size_unit: 'ug', price: 5, stock: 99 },
        withVariant.variants[0],
      ],
    } as never);
    vi.mocked(adjustVariantStock).mockRejectedValue(
      new Error('Cannot remove 5 from a stock of 2'),
    );
    renderEditPage();
    await screen.findByText('4');

    await userEvent.click(screen.getByRole('button', { name: /adjust stock for CAT-A/i }));
    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await screen.findByText(/cannot remove 5/i);

    // Straight to the other variant, without closing.
    await userEvent.click(screen.getByRole('button', { name: /adjust stock for CAT-Z/i }));

    expect(screen.getByLabelText(/units to add or remove/i)).toHaveValue(null);
    expect(screen.queryByText(/cannot remove 5/i)).not.toBeInTheDocument();
  });

  it('refuses a fractional adjustment before the server has to', async () => {
    // The input is a bare type="number" outside any form, so no constraint
    // validation runs. "2.5" reached the server, pydantic refused it, and the
    // admin read "Input should be a valid integer".
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '2.5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText(/whole number/i)).toBeInTheDocument();
    expect(vi.mocked(adjustVariantStock)).not.toHaveBeenCalled();
  });

  it('opens clean rather than carrying the last attempt over', async () => {
    /*
     * Dismissing by clicking the backdrop left the typed delta and the error
     * behind, so opening the dialog on another variant showed the previous
     * one's error above a pre-filled -5 - one click from taking five units off
     * the wrong product.
     */
    vi.mocked(adjustVariantStock).mockRejectedValue(new Error('Cannot remove 5 from a stock of 2'));
    await openAdjustDialog();
    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await screen.findByText(/cannot remove 5/i);

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));

    expect(screen.getByLabelText(/units to add or remove/i)).toHaveValue(null);
    expect(screen.queryByText(/cannot remove 5/i)).not.toBeInTheDocument();
  });

  it('reports a refused adjustment instead of pretending it worked', async () => {
    vi.mocked(adjustVariantStock).mockRejectedValue(
      new Error('Cannot remove 5 from a stock of 2'),
    );
    await openAdjustDialog();

    await userEvent.type(screen.getByLabelText(/units to add or remove/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText(/cannot remove 5 from a stock of 2/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
