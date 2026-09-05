import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToCartButton } from './AddToCartButton';
import { renderWithProviders } from '../../test/renderWithProviders';
import { setupLocalStorageStub } from '../../test/localStorageStub';
import { createMockUser } from '../../test/mocks/mockUser';
import type { AddToCartItem } from '../../types/cart_types';

const item: AddToCartItem = {
  productId: 'p1',
  variantId: 'v1',
  name: 'Tau-441 Recombinant Standard',
  imageUrl: '',
  catalogNumber: 'STD-341-25',
  sizeLabel: '25ug',
  unitPrice: 240,
  quantity: 1,
};

describe('AddToCartButton', () => {
  // The cart is persisted per user, so without this an item added by one test
  // is still there for the next and the button reads "In cart".
  setupLocalStorageStub();

  describe('when the variant is out of stock', () => {
    it('cannot be used', async () => {
      // The listing pages knew nothing about stock, so the shortest path to a
      // broken order was the most prominent button on the site: add an
      // out-of-stock product from the home page, pay, and have it fail at
      // admin-confirm - after the card was already authorized.
      renderWithProviders(<AddToCartButton item={item} available={0} />, {
        user: createMockUser(),
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('says why rather than being a dead grey button', () => {
      renderWithProviders(<AddToCartButton item={item} available={0} />, {
        user: createMockUser(),
      });

      expect(screen.getByRole('button', { name: /out of stock/i })).toBeInTheDocument();
    });

    it('does not add to the cart when clicked', async () => {
      renderWithProviders(<AddToCartButton item={item} available={0} />, {
        user: createMockUser(),
      });

      await userEvent.click(screen.getByRole('button'), { pointerEventsCheck: 0 });

      expect(screen.queryByText('In cart')).not.toBeInTheDocument();
    });
  });

  describe('when stock is available', () => {
    it('adds to the cart and then reflects that', async () => {
      renderWithProviders(<AddToCartButton item={item} available={4} />, {
        user: createMockUser(),
      });

      const button = screen.getByRole('button', { name: 'Add to cart' });
      expect(button).toBeEnabled();

      await userEvent.click(button);

      expect(await screen.findByRole('button', { name: 'In cart' })).toBeInTheDocument();
    });
  });

  describe('when stock is not known', () => {
    it('stays usable, so callers that cannot supply it still work', () => {
      // The product detail page does its own, finer-grained check per variant.
      renderWithProviders(<AddToCartButton item={item} />, { user: createMockUser() });
      expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    });
  });

  describe('when signed out', () => {
    it('explains rather than adding silently', async () => {
      const showReminder = vi.fn();
      renderWithProviders(<AddToCartButton item={item} available={4} />, {
        user: null,
        reminderValue: { showReminder },
      });

      await userEvent.click(screen.getByRole('button'));

      expect(showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/sign in/i) }),
      );
    });
  });
});
