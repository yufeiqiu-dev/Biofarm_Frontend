import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCartSideBar } from './useCartSideBar';
import { createProviderWrapper } from '../test/renderWithProviders';
import { createMockUser } from '../test/mocks/mockUser';
import type { AddToCartItem } from '../types/cart_types';
import type { CartResponse } from '../api/cart';

vi.mock('../api/cart', () => ({
  getCart: vi.fn(),
  syncCart: vi.fn(),
}));

const { getCart, syncCart } = await import('../api/cart');

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

function serverLine(overrides: Partial<CartResponse['items'][number]> = {}) {
  return {
    variant_id: 'v1',
    product_id: 'p1',
    name: 'Test Product',
    catalog_number: 'CAT-001',
    size_label: '100g',
    image_url: '',
    unit_price: 9.99,
    quantity: 1,
    available: 10,
    over_stock: false,
    client_updated_at: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptyCart: CartResponse = { items: [], subtotal: 0, unavailable: [] };

function storedLine(overrides: Record<string, unknown> = {}) {
  return {
    variantId: 'v1',
    productId: 'p1',
    name: 'Test Product',
    imageUrl: '',
    catalogNumber: 'CAT-001',
    sizeLabel: '100g',
    unitPrice: 9.99,
    quantity: 1,
    clientUpdatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderCart(user: typeof mockUser | null = mockUser) {
  return renderHook(() => useCartSideBar(), {
    wrapper: createProviderWrapper({ user }),
  });
}

/*
 * The basket is local-first: localStorage is the working copy, and the server
 * is brought into sync at a handful of points rather than on every click - see
 * CartSideBarContext and
 * Biofarm_KnowledgeBase/documentation/designs/2026-09-08-local-first-cart-sync.md
 */
describe('CartSideBarContext', () => {
  beforeEach(() => {
    vi.mocked(getCart).mockReset().mockResolvedValue(emptyCart);
    vi.mocked(syncCart).mockReset().mockResolvedValue(emptyCart);
  });

  describe('reading the basket', () => {
    it('shows what this device already has, synchronously, with no request in the path', () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 3 })]));

      const { result } = renderCart();

      // No waitFor: this is the point - the first render already has it.
      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(3);
      expect(result.current.cartItems[0].id).toBe('p1-v1');
    });

    it('keeps a guest and a signed-in visitor apart', () => {
      localStorage.setItem('cart:guest', JSON.stringify([storedLine({ variantId: 'v-guest' })]));
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ variantId: 'v-user' })]));

      const guest = renderCart(null);
      expect(guest.result.current.cartItems[0].variantId).toBe('v-guest');

      const signedIn = renderCart(mockUser);
      expect(signedIn.result.current.cartItems[0].variantId).toBe('v-user');
    });

    it('reports overstocked lines as unavailable', () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ available: 2, overStock: true })]),
      );

      const { result } = renderCart();

      expect(result.current.unavailable).toEqual(['CAT-001']);
    });
  });

  describe('editing the basket', () => {
    it('adds a new line', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(makeItem()));

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(1);
    });

    it('adds to the quantity already there, by variant - not productId', () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 2 })]));
      const { result } = renderCart();

      act(() => result.current.addToCart(makeItem({ quantity: 1 })));

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(3);
    });

    it('persists every edit to localStorage immediately', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(makeItem()));

      const saved = JSON.parse(localStorage.getItem('cart:user-1') ?? '[]');
      expect(saved).toHaveLength(1);
      expect(saved[0].quantity).toBe(1);
    });

    it('removes a line', () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine()]));
      const { result } = renderCart();

      act(() => result.current.removeFromCart('p1-v1'));

      expect(result.current.cartItems).toHaveLength(0);
    });

    it('increases and decreases quantity', () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 2 })]));
      const { result } = renderCart();

      act(() => result.current.increaseQuantity('p1-v1'));
      expect(result.current.cartItems[0].quantity).toBe(3);

      act(() => result.current.decreaseQuantity('p1-v1'));
      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('removes the line rather than writing zero', () => {
      // The server's own CHECK (quantity > 0) agrees: zero is not a line.
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 1 })]));
      const { result } = renderCart();

      act(() => result.current.decreaseQuantity('p1-v1'));

      expect(result.current.cartItems).toHaveLength(0);
    });

    it('does not drop an edit when two clicks land in the same tick', () => {
      // The write is computed from the freshest known quantity, not from a
      // stale render closure - so two rapid presses of "+" both count.
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 1 })]));
      const { result } = renderCart();

      act(() => {
        result.current.increaseQuantity('p1-v1');
        result.current.increaseQuantity('p1-v1');
      });

      expect(result.current.cartItems[0].quantity).toBe(3);
    });

    it('clears every line at once', () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ variantId: 'v1' }), storedLine({ variantId: 'v2' })]),
      );
      const { result } = renderCart();

      act(() => result.current.clearCart());

      expect(result.current.cartItems).toHaveLength(0);
    });

    it('clears the stock warning along with the basket it describes', () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ available: 2, overStock: true })]),
      );
      const { result } = renderCart();
      expect(result.current.unavailable).toEqual(['CAT-001']);

      act(() => result.current.clearCart());

      expect(result.current.unavailable).toEqual([]);
    });
  });

  describe('guests', () => {
    it('never calls the cart API, on mount or on edit', async () => {
      const { result } = renderCart(null);

      act(() => result.current.addToCart(makeItem()));
      await act(async () => {
        vi.useFakeTimers();
        await vi.advanceTimersByTimeAsync(1000);
        vi.useRealTimers();
      });

      expect(getCart).not.toHaveBeenCalled();
      expect(syncCart).not.toHaveBeenCalled();
    });

    it('refreshCart is a harmless no-op for a guest', async () => {
      const { result } = renderCart(null);

      await act(async () => {
        await result.current.refreshCart();
      });

      expect(getCart).not.toHaveBeenCalled();
    });

    it('does not push on pagehide or tab-hide either - not just on the debounce path', async () => {
      // The debounce effect is gated on ownerId before it ever schedules a
      // flush, but the pagehide/visibilitychange listeners are not - they are
      // set up once and call flush() unconditionally, so flush() itself has to
      // be the thing that refuses a guest, or this path would leak a request.
      const { result } = renderCart(null);
      act(() => result.current.addToCart(makeItem()));

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
      });

      expect(syncCart).not.toHaveBeenCalled();
    });
  });

  describe('signing in - pull, merge, push', () => {
    it('pulls the server basket on mount for a signed-in visitor', async () => {
      vi.mocked(getCart).mockResolvedValue({ items: [serverLine({ quantity: 4 })], subtotal: 39.96, unavailable: [] });

      const { result } = renderCart();

      await waitFor(() => expect(result.current.cartItems).toHaveLength(1));
      expect(result.current.cartItems[0].quantity).toBe(4);
    });

    it('folds in a basket left behind by browsing as a guest, then clears it', async () => {
      localStorage.setItem(
        'cart:guest',
        JSON.stringify([storedLine({ variantId: 'v-guest', clientUpdatedAt: '2026-01-01T00:00:00.000Z' })]),
      );

      const { result } = renderCart();

      await waitFor(() =>
        expect(result.current.cartItems.map((i) => i.variantId)).toContain('v-guest'),
      );
      expect(localStorage.getItem('cart:guest')).toBeNull();
    });

    it('keeps the newer side per line - server beats a stale local copy', async () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 1, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [serverLine({ quantity: 9, client_updated_at: '2026-01-02T00:00:00.000Z' })],
        subtotal: 89.91,
        unavailable: [],
      });

      const { result } = renderCart();

      await waitFor(() => expect(result.current.cartItems[0]?.quantity).toBe(9));
    });

    it('a device newer than the server keeps its own copy rather than being overwritten', async () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 7, clientUpdatedAt: '2026-06-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [serverLine({ quantity: 1, client_updated_at: '2020-01-01T00:00:00.000Z' })],
        subtotal: 9.99,
        unavailable: [],
      });

      const { result } = renderCart();

      await waitFor(() => expect(syncCart).toHaveBeenCalled());
      expect(result.current.cartItems[0].quantity).toBe(7);
    });

    it('does not lose this device\'s basket if the pull itself fails', async () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine({ quantity: 5 })]));
      vi.mocked(getCart).mockRejectedValue(new Error('offline'));

      const { result } = renderCart();

      await waitFor(() => expect(result.current.cartItems).toHaveLength(1));
      expect(result.current.cartItems[0].quantity).toBe(5);
    });

    it('refreshCart re-pulls on demand, for the cart page\'s own pull point', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));

      vi.mocked(getCart).mockResolvedValue({ items: [serverLine({ quantity: 6 })], subtotal: 59.94, unavailable: [] });
      await act(async () => {
        await result.current.refreshCart();
      });

      expect(result.current.cartItems[0].quantity).toBe(6);
    });

    it('accepts a deletion the server reports, even for a line this device still holds live', async () => {
      // The subway-tunnel scenario on the pull side: another device deleted v1
      // and synced it; the server's live `items` simply omit v1, which a union
      // merge would keep. The tombstone in `deleted_lines` is what carries the
      // deletion across.
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 3, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [],
        subtotal: 0,
        unavailable: [],
        deleted_lines: [{ variant_id: 'v1', client_updated_at: '2026-02-01T00:00:00.000Z' }],
      });

      const { result } = renderCart();

      await waitFor(() => expect(result.current.cartItems).toHaveLength(0));
    });

    it('keeps a line this device edited more recently than the server\'s deletion', async () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 4, clientUpdatedAt: '2026-03-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [],
        subtotal: 0,
        unavailable: [],
        deleted_lines: [{ variant_id: 'v1', client_updated_at: '2026-02-01T00:00:00.000Z' }],
      });

      const { result } = renderCart();

      await waitFor(() => expect(syncCart).toHaveBeenCalled());
      expect(result.current.cartItems[0].quantity).toBe(4);
    });

    it('pulls once when the mount reconcile and refreshCart fire together', async () => {
      // A full load landing on /cart while signed in: the provider effect and
      // the page's refreshCart both run in the same tick. They must share one
      // GET, not fire two.
      const { result } = renderCart();
      await act(async () => {
        await result.current.refreshCart();
      });

      expect(getCart).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncing to the server', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('does not push immediately - only after a pause in editing', async () => {
      const { result } = renderCart();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // let the mount reconcile settle
      vi.mocked(syncCart).mockClear();

      act(() => result.current.addToCart(makeItem()));
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });

      expect(syncCart).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(500); });

      expect(syncCart).toHaveBeenCalledTimes(1);
    });

    it('coalesces a burst of edits into one push', async () => {
      const { result } = renderCart();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      vi.mocked(syncCart).mockClear();

      act(() => result.current.addToCart(makeItem()));
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      act(() => result.current.increaseQuantity('p1-v1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
      act(() => result.current.increaseQuantity('p1-v1'));

      await act(async () => { await vi.advanceTimersByTimeAsync(600); });

      expect(syncCart).toHaveBeenCalledTimes(1);
      expect(syncCart).toHaveBeenCalledWith(
        [expect.objectContaining({ variant_id: 'v1', quantity: 3, deleted: false })],
        {},
      );
    });

    it('sends a tombstone with deleted: true, not a bare removal', async () => {
      localStorage.setItem('cart:user-1', JSON.stringify([storedLine()]));
      const { result } = renderCart();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      vi.mocked(syncCart).mockClear();

      act(() => result.current.removeFromCart('p1-v1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });

      expect(syncCart).toHaveBeenCalledWith(
        [expect.objectContaining({ variant_id: 'v1', deleted: true })],
        {},
      );
    });
  });

  describe('tab hide and close', () => {
    it('flushes on visibilitychange turning hidden', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalled());
      vi.mocked(syncCart).mockClear();

      act(() => result.current.addToCart(makeItem()));

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(syncCart).toHaveBeenCalledWith(
        [expect.objectContaining({ variant_id: 'v1' })],
        {},
      );
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });

    it('flushes on pagehide with keepalive, so the request can outlive the page', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalled());
      vi.mocked(syncCart).mockClear();

      act(() => result.current.addToCart(makeItem()));

      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
      });

      expect(syncCart).toHaveBeenCalledWith(
        [expect.objectContaining({ variant_id: 'v1' })],
        { keepalive: true },
      );
    });

    it('does not push when there is nothing to send', async () => {
      renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalled());
      vi.mocked(syncCart).mockClear();

      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
      });

      expect(syncCart).not.toHaveBeenCalled();
    });
  });

  describe('a push failing', () => {
    it('does not lose the edit - it stays on screen and in storage', async () => {
      vi.mocked(syncCart).mockRejectedValue(new Error('offline'));
      const { result } = renderCart();

      act(() => result.current.addToCart(makeItem()));

      expect(result.current.cartItems).toHaveLength(1);
      expect(JSON.parse(localStorage.getItem('cart:user-1') ?? '[]')).toHaveLength(1);
    });
  });

  describe('an edit landing while a push is in flight', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reaches the server even when the push overruns the next debounce', async () => {
      // The hard case: a slow push is still hanging when the second edit's own
      // debounce fires. Nothing else re-triggers that debounce, so the second
      // edit must be sent right then - not held behind the in-flight one.
      const { result } = renderCart();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      vi.mocked(syncCart).mockClear();

      let releaseFirst: (value: CartResponse) => void = () => {};
      vi.mocked(syncCart)
        .mockImplementationOnce(() => new Promise<CartResponse>((r) => { releaseFirst = r; }))
        .mockResolvedValue(emptyCart);

      act(() => result.current.addToCart(makeItem({ quantity: 1 })));
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(syncCart).toHaveBeenCalledTimes(1);

      // Second edit, then let its debounce fire - the first push is STILL hung.
      act(() => result.current.increaseQuantity('p1-v1'));
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });

      expect(syncCart).toHaveBeenCalledTimes(2);
      expect(syncCart).toHaveBeenLastCalledWith(
        [expect.objectContaining({ variant_id: 'v1', quantity: 2 })],
        {},
      );

      await act(async () => { releaseFirst(emptyCart); });
    });
  });

  describe('a pull point with nothing to push', () => {
    it('opens the cart without a PUT when the merge matches the server', async () => {
      // The common case: no local edits, server cart already in sync. A GET,
      // and nothing else.
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 2, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [serverLine({ quantity: 2, client_updated_at: '2026-01-01T00:00:00.000Z' })],
        subtotal: 19.98,
        unavailable: [],
        deleted_lines: [],
      });

      const { result } = renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalled());
      await act(async () => { await result.current.refreshCart(); });

      expect(syncCart).not.toHaveBeenCalled();
    });

    it('does push when a local line is newer than the server\'s', async () => {
      localStorage.setItem(
        'cart:user-1',
        JSON.stringify([storedLine({ quantity: 9, clientUpdatedAt: '2026-06-01T00:00:00.000Z' })]),
      );
      vi.mocked(getCart).mockResolvedValue({
        items: [serverLine({ quantity: 2, client_updated_at: '2026-01-01T00:00:00.000Z' })],
        subtotal: 19.98,
        unavailable: [],
        deleted_lines: [],
      });

      renderCart();

      await waitFor(() => expect(syncCart).toHaveBeenCalled());
    });
  });

  describe('clearCart on an already-empty basket', () => {
    it('is a no-op - no dirty flag, no push', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(getCart).toHaveBeenCalled());
      vi.mocked(syncCart).mockClear();

      act(() => result.current.clearCart());
      act(() => result.current.clearCart());

      // Wait past any debounce.
      await new Promise((r) => setTimeout(r, 700));
      expect(syncCart).not.toHaveBeenCalled();
    });
  });
});
