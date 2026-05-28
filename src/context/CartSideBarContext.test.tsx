import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCartSideBar } from './CartSideBarContext';
import { createProviderWrapper } from '../test/renderWithProviders';
import { setupLocalStorageStub } from '../test/localStorageStub';
import { createMockUser } from '../test/mocks/mockUser';
import type { AddToCartItem } from '../types/cart_types';

const mockUser = createMockUser({ user_id: 'user-1' });

function makeItem(overrides: Partial<AddToCartItem> = {}): AddToCartItem {
  return {
    productId: 'p1',
    variantId: 'v1',
    name: 'Test Product',
    imageUrl: '',
    catalogNumber: 'CAT-001',
    sizeLabel: '100g',
    unitPrice: 9.99,
    quantity: 1,
    ...overrides,
  };
}

describe('CartSideBarContext', () => {
  const store = setupLocalStorageStub();

  describe('addToCart', () => {
    let unmountHook: () => void;
    afterEach(() => unmountHook?.());

    it('creates a new cart item with id = productId-variantId', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => { result.current.addToCart(makeItem({ productId: 'p1', variantId: 'v1' })); });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].id).toBe('p1-v1');
      expect(result.current.cartItems[0].quantity).toBe(1);
    });

    it('increments quantity when same variantId is added again', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem({ quantity: 1 }));
        result.current.addToCart(makeItem({ quantity: 2 }));
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(3);
    });

    it('persists cart to localStorage under cart:{userId}', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => { result.current.addToCart(makeItem()); });

      const raw = store.get('cart:user-1');
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('p1-v1');
    });
  });

  describe('removeFromCart', () => {
    let unmountHook: () => void;
    afterEach(() => unmountHook?.());

    it('removes the item matching the given id', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem());
        result.current.removeFromCart('p1-v1');
      });

      expect(result.current.cartItems).toHaveLength(0);
    });

    it('is a no-op when id does not exist', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem());
        result.current.removeFromCart('nonexistent');
      });

      expect(result.current.cartItems).toHaveLength(1);
    });
  });

  describe('increaseQuantity', () => {
    let unmountHook: () => void;
    afterEach(() => unmountHook?.());

    it('increments the item quantity by 1', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem({ quantity: 2 }));
        result.current.increaseQuantity('p1-v1');
      });

      expect(result.current.cartItems[0].quantity).toBe(3);
    });
  });

  describe('decreaseQuantity', () => {
    let unmountHook: () => void;
    afterEach(() => unmountHook?.());

    it('decrements the item quantity by 1', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem({ quantity: 3 }));
        result.current.decreaseQuantity('p1-v1');
      });

      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('removes item entirely when quantity is 1 and decrease is called', () => {
      const { result, unmount } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });
      unmountHook = unmount;

      act(() => {
        result.current.addToCart(makeItem({ quantity: 1 }));
        result.current.decreaseQuantity('p1-v1');
      });

      expect(result.current.cartItems).toHaveLength(0);
    });
  });

  describe('localStorage persistence', () => {
    it('loads existing cart from localStorage on mount', async () => {
      const existing = [{ id: 'p1-v1', productId: 'p1', variantId: 'v1', name: 'Test', imageUrl: '', catalogNumber: 'C', sizeLabel: '100g', unitPrice: 9.99, quantity: 2 }];
      store.set('cart:user-1', JSON.stringify(existing));

      const { result } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });

      await waitFor(() => {
        expect(result.current.cartItems).toHaveLength(1);
      });
      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('produces an empty cart when localStorage contains malformed JSON', async () => {
      store.set('cart:user-1', 'NOT_JSON{{{');

      const { result } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: mockUser }),
      });

      await waitFor(() => {
        expect(result.current.cartItems).toHaveLength(0);
      });
    });

    it('starts with empty cart when user is null', async () => {
      const { result } = renderHook(() => useCartSideBar(), {
        wrapper: createProviderWrapper({ user: null }),
      });

      await waitFor(() => {
        expect(result.current.cartItems).toHaveLength(0);
      });
    });
  });
});
