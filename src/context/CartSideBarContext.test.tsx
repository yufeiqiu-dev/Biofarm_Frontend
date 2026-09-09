import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCartSideBar } from './useCartSideBar';
import { createProviderWrapper } from '../test/renderWithProviders';
import { createMockUser } from '../test/mocks/mockUser';
import type { AddToCartItem } from '../types/cart_types';
import type { CartResponse } from '../api/cart';
import { ApiError } from '../api/client';

vi.mock('../api/cart', () => ({
  getCart: vi.fn(),
  setCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearServerCart: vi.fn(),
}));

const { getCart, setCartLine, removeCartLine, clearServerCart } = await import('../api/cart');

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

/** A server basket holding one line of `quantity`. */
function serverCart(quantity: number, overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    items: [
      {
        variant_id: 'v1',
        product_id: 'p1',
        name: 'Test Product',
        catalog_number: 'CAT-001',
        size_label: '100g',
        image_url: '',
        unit_price: 9.99,
        quantity,
        available: 10,
        over_stock: false,
      },
    ],
    subtotal: 9.99 * quantity,
    unavailable: [],
    ...overrides,
  };
}

const emptyCart: CartResponse = { items: [], subtotal: 0, unavailable: [] };

function renderCart(user = mockUser) {
  return renderHook(() => useCartSideBar(), {
    wrapper: createProviderWrapper({ user }),
  });
}

/*
 * The basket lives on the server.
 *
 * It used to live in localStorage under `cart:{sub}`, which ties a basket to a
 * device rather than to a person: fill one on a phone, sign in on a laptop, and
 * it is gone.
 */
describe('CartSideBarContext', () => {
  beforeEach(() => {
    vi.mocked(getCart).mockReset().mockResolvedValue(emptyCart);
    vi.mocked(setCartLine).mockReset().mockResolvedValue(emptyCart);
    vi.mocked(removeCartLine).mockReset().mockResolvedValue(emptyCart);
    vi.mocked(clearServerCart).mockReset().mockResolvedValue(undefined);
  });

  it('loads the saved basket, so it survives the device', async () => {
    vi.mocked(getCart).mockResolvedValue(serverCart(3));

    const { result } = renderCart();

    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));
    expect(result.current.cartItems[0].quantity).toBe(3);
    expect(result.current.cartItems[0].id).toBe('p1-v1');
  });

  it('does not fetch a basket for a visitor who is not signed in', async () => {
    const { result } = renderCart(null as never);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCart).not.toHaveBeenCalled();
    expect(result.current.cartItems).toEqual([]);
  });

  it('shows the line before the server answers', async () => {
    // A basket is direct manipulation: waiting for a round trip before the
    // quantity moves makes every press feel broken.
    let resolve: (value: CartResponse) => void = () => {};
    vi.mocked(setCartLine).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addToCart(makeItem()));

    expect(result.current.cartItems).toHaveLength(1);
    await act(async () => { resolve(serverCart(1)); });
  });

  it('adds to the quantity already in the basket, by variant', async () => {
    // Deduped by variantId, not productId: two sizes of one product are two
    // lines. The server is sent the total, because the endpoint sets a
    // quantity rather than adding to one.
    vi.mocked(getCart).mockResolvedValue(serverCart(2));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    act(() => result.current.addToCart(makeItem({ quantity: 1 })));

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 3));
  });

  it('puts the basket back when the server refuses', async () => {
    /*
     * Without the rollback the customer is left looking at a basket that does
     * not exist, and finds out at checkout - the worst possible moment.
     */
    vi.mocked(getCart).mockResolvedValue(serverCart(2));
    vi.mocked(setCartLine).mockRejectedValue(new Error('offline'));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    await act(async () => { result.current.addToCart(makeItem({ quantity: 1 })); });

    await waitFor(() => expect(result.current.cartItems[0].quantity).toBe(2));
  });

  it('says so when a change could not be saved', async () => {
    // Silently keeping a change the server refused would be worse than either
    // showing it or dropping it.
    const showReminder = vi.fn();
    vi.mocked(setCartLine).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCartSideBar(), {
      wrapper: createProviderWrapper({ user: mockUser, reminderValue: { showReminder } }),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addToCart(makeItem()); });

    await waitFor(() =>
      expect(showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/could not update your cart/i) }),
      ),
    );
  });

  it('takes the server’s answer over its own arithmetic', async () => {
    // The server applied the change to what is actually saved, which may have
    // moved since this page loaded.
    vi.mocked(setCartLine).mockResolvedValue(serverCart(7));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addToCart(makeItem({ quantity: 1 })); });

    await waitFor(() => expect(result.current.cartItems[0].quantity).toBe(7));
  });

  it('removes a line through the server', async () => {
    vi.mocked(getCart).mockResolvedValue(serverCart(1));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    await act(async () => { result.current.removeFromCart('p1-v1'); });

    expect(removeCartLine).toHaveBeenCalledWith('v1');
    await waitFor(() => expect(result.current.cartItems).toHaveLength(0));
  });

  it('increases and decreases by setting the new quantity', async () => {
    vi.mocked(getCart).mockResolvedValue(serverCart(2));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    await act(async () => { result.current.increaseQuantity('p1-v1'); });
    expect(setCartLine).toHaveBeenCalledWith('v1', 3);

    vi.mocked(getCart).mockResolvedValue(serverCart(2));
    await act(async () => { result.current.decreaseQuantity('p1-v1'); });
    expect(setCartLine).toHaveBeenCalledWith('v1', expect.any(Number));
  });

  it('removes the line when the last one is taken off it', async () => {
    // Quantity zero is a line that should not be there, and the database
    // refuses it anyway.
    vi.mocked(getCart).mockResolvedValue(serverCart(1));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    await act(async () => { result.current.decreaseQuantity('p1-v1'); });

    expect(setCartLine).toHaveBeenCalledWith('v1', 0);
    await waitFor(() => expect(result.current.cartItems).toHaveLength(0));
  });

  it('empties the basket on the server, not just on screen', async () => {
    // Bypass mode creates the order inline with no webhook, so this call is the
    // only signal the server gets that the basket was bought.
    vi.mocked(getCart).mockResolvedValue(serverCart(1));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    await act(async () => { result.current.clearCart(); });

    expect(clearServerCart).toHaveBeenCalled();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(0));
  });

  it('reports what the customer cannot have in full', async () => {
    // Reported, not trimmed: quietly shrinking a basket is how someone buys
    // fewer than they meant and finds out from the receipt.
    vi.mocked(getCart).mockResolvedValue({
      ...serverCart(5),
      items: [{ ...serverCart(5).items[0], available: 2, over_stock: true }],
      unavailable: ['CAT-001'],
    });

    const { result } = renderCart();

    await waitFor(() => expect(result.current.unavailable).toEqual(['CAT-001']));
    expect(result.current.cartItems[0].quantity).toBe(5);
    expect(result.current.cartItems[0].available).toBe(2);
    expect(result.current.cartItems[0].overStock).toBe(true);
  });

  it('shows an empty basket rather than a stale one if it cannot be read', async () => {
    vi.mocked(getCart).mockRejectedValue(new Error('offline'));

    const { result } = renderCart();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cartItems).toEqual([]);
  });

  it('refuses to write against a basket it has not read', async () => {
    /*
     * The write sends an absolute quantity computed from what is on screen, so
     * acting on a basket that is still loading overwrites the real one: five in
     * the basket, a click before the load lands, and the server is told "1".
     */
    let resolve: (value: CartResponse) => void = () => {};
    vi.mocked(getCart).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderCart();

    act(() => result.current.addToCart(makeItem()));

    expect(setCartLine).not.toHaveBeenCalled();
    await act(async () => { resolve(emptyCart); });
  });

  it('does not mistake a failed load for an empty basket', async () => {
    /*
     * One timeout used to show "your cart is empty" for the rest of the
     * session while the server held the basket - and because a write is
     * absolute, the next Add computed 0 + 1 and overwrote it with one line.
     */
    vi.mocked(getCart).mockRejectedValue(new Error('offline'));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addToCart(makeItem()); });

    expect(setCartLine).not.toHaveBeenCalled();
  });

  it('ignores a reply that a newer write has already overtaken', async () => {
    // Every reply carries the whole basket, so applying a stale one undoes the
    // change now on screen.
    const answers: ((value: CartResponse) => void)[] = [];
    vi.mocked(setCartLine).mockImplementation(
      () => new Promise((r) => { answers.push(r); }),
    );
    vi.mocked(getCart).mockResolvedValue(serverCart(1));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    act(() => result.current.increaseQuantity('p1-v1'));
    act(() => result.current.increaseQuantity('p1-v1'));

    // The older answer lands last, and must not win.
    await act(async () => {
      answers[1](serverCart(3));
      answers[0](serverCart(2));
    });

    expect(result.current.cartItems[0].quantity).toBe(3);
  });

  it('hands over a basket left by the old localStorage cart', async () => {
    // Otherwise every customer holding one at deploy loses it - a poor way to
    // introduce a feature whose promise is that baskets stop disappearing.
    localStorage.setItem(
      'cart:user-1',
      JSON.stringify([{ variantId: 'v1', quantity: 4 }]),
    );
    vi.mocked(getCart).mockResolvedValue(emptyCart);

    renderCart();

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 4));
    expect(localStorage.getItem('cart:user-1')).toBeNull();
  });

  it('keeps the larger quantity, so a replay cannot double a line', async () => {
    localStorage.setItem(
      'cart:user-1',
      JSON.stringify([{ variantId: 'v1', quantity: 2 }]),
    );
    vi.mocked(getCart).mockResolvedValue(serverCart(5));

    renderCart();

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 5));
  });

  it('does not drop an increment when two clicks land in one frame', async () => {
    // The write is absolute rather than an increment, so two presses computing
    // from the same rendered quantity send the same number and one press is
    // silently lost.
    vi.mocked(getCart).mockResolvedValue(serverCart(1));
    vi.mocked(setCartLine).mockReturnValue(new Promise(() => {}));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.cartItems).toHaveLength(1));

    act(() => {
      result.current.increaseQuantity('p1-v1');
      result.current.increaseQuantity('p1-v1');
    });

    expect(setCartLine).toHaveBeenNthCalledWith(1, 'v1', 2);
    expect(setCartLine).toHaveBeenNthCalledWith(2, 'v1', 3);
  });

  it('empties the stock warning with the basket it describes', async () => {
    // Otherwise the sidebar reads "… is no longer available" over an empty
    // basket until the next full load.
    vi.mocked(getCart).mockResolvedValue({
      ...serverCart(5),
      items: [{ ...serverCart(5).items[0], available: 2, over_stock: true }],
      unavailable: ['CAT-001'],
    });
    const { result } = renderCart();
    await waitFor(() => expect(result.current.unavailable).toHaveLength(1));

    await act(async () => { result.current.clearCart(); });

    expect(result.current.unavailable).toEqual([]);
  });

  it('still empties the basket before it has finished loading', async () => {
    /*
     * The success page clears once, behind a ref, and never retries. Gating
     * that on the basket having been read meant a customer whose order
     * resolved first was told "your cart is still loading" on the screen
     * confirming their payment, and the basket was never emptied.
     */
    vi.mocked(getCart).mockReturnValue(new Promise(() => {}));
    const { result } = renderCart();

    act(() => result.current.clearCart());

    expect(clearServerCart).toHaveBeenCalled();
  });

  it('hands over the rest of a basket when one line is refused', async () => {
    // One rejection used to abort the loop and the key was dropped anyway, so
    // every later line was lost permanently.
    localStorage.setItem(
      'cart:user-1',
      JSON.stringify([
        { variantId: 'gone', quantity: 1 },
        { variantId: 'v1', quantity: 2 },
      ]),
    );
    vi.mocked(getCart).mockResolvedValue(emptyCart);
    vi.mocked(setCartLine).mockImplementation((variantId: string) =>
      variantId === 'gone'
        ? Promise.reject(new Error('no such variant'))
        : Promise.resolve(emptyCart),
    );

    renderCart();

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 2));
    // Kept, because a line was lost: the next load tries again rather than
    // dropping it for good.
    expect(localStorage.getItem('cart:user-1')).not.toBeNull();
  });

  it('does not resurrect an item the customer has since deleted', async () => {
    /*
     * The handover replays Math.max(local, server), so a key that never goes
     * away brings back quantities that have since changed. Keeping the whole
     * key whenever any line failed made that permanent: delete an item, reload,
     * and it is back - every time, forever.
     */
    localStorage.setItem(
      'cart:user-1',
      JSON.stringify([
        { variantId: 'gone', quantity: 1 },
        { variantId: 'v1', quantity: 3 },
      ]),
    );
    vi.mocked(getCart).mockResolvedValue(emptyCart);
    vi.mocked(setCartLine).mockImplementation((variantId: string) =>
      variantId === 'gone'
        ? Promise.reject(new ApiError('Variant not found', 404))
        : Promise.resolve(emptyCart),
    );

    renderCart();

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 3));
    // The refused line was permanent, so nothing is left to retry.
    expect(localStorage.getItem('cart:user-1')).toBeNull();
  });

  it('keeps a line worth retrying, but only that line', async () => {
    // A network blip is not a refusal. The line that failed comes back; the one
    // already handed over does not, or it would overwrite later edits.
    localStorage.setItem(
      'cart:user-1',
      JSON.stringify([
        { variantId: 'flaky', quantity: 1 },
        { variantId: 'v1', quantity: 3 },
      ]),
    );
    vi.mocked(getCart).mockResolvedValue(emptyCart);
    vi.mocked(setCartLine).mockImplementation((variantId: string) =>
      variantId === 'flaky'
        ? Promise.reject(new Error('network'))
        : Promise.resolve(emptyCart),
    );

    renderCart();

    await waitFor(() => expect(setCartLine).toHaveBeenCalledWith('v1', 3));
    await waitFor(() => {
      const left = JSON.parse(localStorage.getItem('cart:user-1') ?? '[]');
      expect(left).toEqual([{ variantId: 'flaky', quantity: 1 }]);
    });
  });

  it('stops claiming the basket is unreadable once it is emptied', async () => {
    // Nothing would have corrected it: the success page clears once behind a
    // ref, so the session kept saying "we could not load your cart" over a
    // basket that is now definitively empty.
    vi.mocked(getCart).mockRejectedValue(new Error('offline'));
    const { result } = renderCart();
    await waitFor(() => expect(result.current.failed).toBe(true));

    await act(async () => { result.current.clearCart(); });

    await waitFor(() => expect(result.current.failed).toBe(false));
  });
});
