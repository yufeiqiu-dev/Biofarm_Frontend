import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderSuccessPage } from './OrderSuccessPage';
import { CartSideBarProvider } from '../../context/CartSideBarContext';
import { useCartSideBar } from '../../context/useCartSideBar';
import { AuthContext, type AuthContextValue } from '../../auth/useAuth';
import { ReminderContext } from '../../context/useReminder';
import { createMockUser } from '../../test/mocks/mockUser';
import { setupLocalStorageStub } from '../../test/localStorageStub';

vi.mock('../../api/order', () => ({
  getMyOrderByPaymentIntent: vi.fn().mockRejectedValue(new Error('not yet')),
}));

const user = createMockUser();

function auth(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    loading: false,
    isAuthenticated: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshUser: vi.fn(),
    getAccessToken: vi.fn(),
    getUserGroups: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

/**
 * The saved cart, as items. clearCart removes the key and the provider's
 * persistence effect writes an empty array straight back - both mean "no cart",
 * so asserting on the items rather than on the key avoids pinning an
 * implementation detail that does not matter.
 */
function savedCartItems(): unknown[] {
  const raw = localStorage.getItem(`cart:${user.user_id}`);
  return raw ? JSON.parse(raw) : [];
}

function CartProbe() {
  const { cartItems } = useCartSideBar();
  return <span data-testid="count">{cartItems.length}</span>;
}

function renderAt(authValue: AuthContextValue) {
  return render(
    <MemoryRouter initialEntries={['/checkout/success?payment_intent=pi_1&redirect_status=succeeded']}>
      <AuthContext.Provider value={authValue}>
        <ReminderContext.Provider value={{ showReminder: vi.fn(), hideReminder: vi.fn(), reminder: null } as never}>
          <CartSideBarProvider>
            <CartProbe />
            <OrderSuccessPage />
          </CartSideBarProvider>
        </ReminderContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

/**
 * Stripe confirms with `redirect: "always"`, so arriving here is a full page
 * load rather than a client-side navigation: the cart provider mounts fresh and
 * the session is resolved asynchronously afterwards.
 *
 * That is the bug. clearCart only removes the saved copy `if (userId)`, and on
 * the first render after the redirect there is no user yet - so it emptied an
 * already-empty in-memory cart, left localStorage untouched, and when the
 * session resolved a moment later the provider reloaded the paid-for cart
 * straight back out of storage.
 */
describe('OrderSuccessPage clearing the cart', () => {
  setupLocalStorageStub();

  beforeEach(() => {
    localStorage.setItem(
      `cart:${user.user_id}`,
      JSON.stringify([
        { id: 'p1-v1', productId: 'p1', variantId: 'v1', name: 'Anti-Tau', imageUrl: '', catalogNumber: 'AB-101-50', sizeLabel: '50ug', unitPrice: 285, quantity: 1 },
      ]),
    );
  });

  it('empties the cart when the session is already known', async () => {
    renderAt(auth({ user, isAuthenticated: true }));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(savedCartItems()).toEqual([]);
  });

  it('still empties it when the session resolves after the redirect', async () => {
    // The real sequence. Stripe sends the browser back, the page renders before
    // Amplify has restored the session, and the user appears a moment later.
    const { rerender } = renderAt(auth({ loading: true }));

    rerender(
      <MemoryRouter initialEntries={['/checkout/success?payment_intent=pi_1&redirect_status=succeeded']}>
        <AuthContext.Provider value={auth({ user, isAuthenticated: true })}>
          <ReminderContext.Provider value={{ showReminder: vi.fn(), hideReminder: vi.fn(), reminder: null } as never}>
            <CartSideBarProvider>
              <CartProbe />
              <OrderSuccessPage />
            </CartSideBarProvider>
          </ReminderContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(savedCartItems()).toEqual([]);
  });
});
