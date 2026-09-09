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
  getMyOrderByPaymentIntent: vi.fn(),
  getMyOrder: vi.fn(),
}));

const fetchOrder = vi.mocked(
  (await import('../../api/order')).getMyOrderByPaymentIntent,
);
const fetchOrderById = vi.mocked((await import('../../api/order')).getMyOrder);

/** The order the webhook would have created. */
function anOrder() {
  return {
    id: 'o1',
    order_number: 1042,
    status: 'awaiting_fulfillment',
    created_at: new Date().toISOString(),
    total_amount: 285,
    shipping_amount: 25,
    tax_amount: 24.94,
    card_brand: 'visa',
    card_last4: '4242',
    shipping_name: 'Jane Smith',
    shipping_address1: '123 Main St',
    shipping_city: 'Springfield',
    shipping_state: 'IL',
    shipping_zip: '62701',
    items: [
      {
        id: 'i1',
        variant_id: 'v1',
        product_name: 'Anti-Tau',
        variant_label: '50 ug',
        unit_price: 285,
        quantity: 1,
      },
    ],
  } as never;
}

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

  it('empties the cart once the order is confirmed', async () => {
    fetchOrder.mockResolvedValue(anOrder());
    renderAt(auth({ user, isAuthenticated: true }));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(savedCartItems()).toEqual([]);
  });

  it('still empties it when the session resolves after the redirect', async () => {
    // The real sequence. Stripe sends the browser back, the page renders before
    // Amplify has restored the session, and the user appears a moment later.
    fetchOrder.mockResolvedValue(anOrder());
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

/*
 * Arriving here is a Stripe redirect on redirect_status=succeeded, which means
 * the card was authorised - not that an order exists. If the item sold out while
 * the customer was paying, the webhook voids that authorisation and creates
 * nothing.
 *
 * The page used to render a green tick, "Order Placed!" and "Your payment was
 * successful" to exactly that person, tell them to look in My Orders for
 * something that would never arrive, and empty their cart on the way.
 */
describe('OrderSuccessPage when no order ever appears', () => {
  setupLocalStorageStub();

  beforeEach(() => {
    localStorage.setItem(
      `cart:${user.user_id}`,
      JSON.stringify([
        { id: 'p1-v1', productId: 'p1', variantId: 'v1', name: 'Anti-Tau', imageUrl: '', catalogNumber: 'AB-101-50', sizeLabel: '50ug', unitPrice: 285, quantity: 1 },
      ]),
    );
    fetchOrder.mockRejectedValue(new Error('not found'));
  });

  it('does not claim the order was placed', async () => {
    renderAt(auth({ user, isAuthenticated: true }));

    await screen.findByRole('heading', { name: /couldn.t confirm your order/i }, { timeout: 15000 });

    expect(screen.queryByText(/order placed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment was successful/i)).not.toBeInTheDocument();
  }, 20000);

  it('says the money comes back if the item sold out, without promising how', async () => {
    /*
     * It used to assert "you have not been charged". Sold out reaches the
     * webhook from payment_intent.succeeded as well as the capturable event, so
     * the intent may already hold real money - the void is refused and a refund
     * issued instead. Sold out also means no order is ever created, so this is
     * the screen that customer lands on: told they were not charged, sometimes
     * moments after they were.
     */
    renderAt(auth({ user, isAuthenticated: true }));

    await screen.findByRole('heading', { name: /couldn.t confirm your order/i }, { timeout: 15000 });
    expect(screen.queryByText(/you have not been charged/i)).not.toBeInTheDocument();
    expect(screen.getByText(/refund it if your card was already charged/i)).toBeInTheDocument();
  }, 20000);

  it('keeps the cart, so they can order again', async () => {
    renderAt(auth({ user, isAuthenticated: true }));

    await screen.findByRole('heading', { name: /couldn.t confirm your order/i }, { timeout: 15000 });

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(savedCartItems()).toHaveLength(1);
  }, 20000);
});

/*
 * Bypass mode creates the order inline and redirects with its id. It used to
 * send that id in a parameter called `payment_intent`, which it is not - the
 * bypass PaymentIntent id is `pi_bypass_…` - so the page polled for an intent
 * that could never match and gave up every time.
 *
 * That was invisible while the page claimed success regardless. Once it started
 * telling the truth, every local checkout ended on "we couldn't confirm your
 * order" for an order that had been created synchronously.
 */
describe('OrderSuccessPage in bypass mode', () => {
  setupLocalStorageStub();

  beforeEach(() => {
    localStorage.setItem(
      `cart:${user.user_id}`,
      JSON.stringify([
        { id: 'p1-v1', productId: 'p1', variantId: 'v1', name: 'Anti-Tau', imageUrl: '', catalogNumber: 'AB-101-50', sizeLabel: '50ug', unitPrice: 285, quantity: 1 },
      ]),
    );
  });

  function renderWithOrderId(authValue: AuthContextValue) {
    return render(
      <MemoryRouter initialEntries={['/checkout/success?order_id=o1&redirect_status=succeeded']}>
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

  /*
   * The receipt is what a customer reads immediately after paying, so it has to
   * show the amount the card was actually charged. It omitted the shipping fee
   * - the same dropped shipping_amount the admin response had, on the other
   * side of the till.
   */
  it('adds its own rows up to its own total', async () => {
    // Subtotal came from the item lines while Total came from total_amount, so
    // the receipt's arithmetic held only while those happened to agree - in one
    // visible block, on the screen read straight after paying. Read back off
    // the rendered rows rather than asserting strings, since that is the claim.
    fetchOrderById.mockResolvedValue(anOrder());
    renderWithOrderId(auth({ user, isAuthenticated: true }));

    await screen.findByText('Shipping');

    const amountFor = (label: string) => {
      const row = screen.getByText(label).parentElement!;
      return Number(row.textContent!.replace(label, '').replace(/[$,]/g, ''));
    };

    const sum = amountFor('Subtotal') + amountFor('Shipping') + amountFor('Tax (8.05%)');
    expect(sum).toBeCloseTo(amountFor('Total'), 2);
  });

  it('shows the shipping fee and includes it in the total', async () => {
    fetchOrderById.mockResolvedValue(anOrder());
    renderWithOrderId(auth({ user, isAuthenticated: true }));

    expect(await screen.findByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    // 285 + 25 + 24.94, which is what Stripe captured.
    expect(screen.getByText('$334.94')).toBeInTheDocument();
  });

  it('rates the tax against goods plus shipping', async () => {
    // calculate_tax passes shipping to Stripe Tax because most US states tax
    // delivery, so the goods subtotal alone overstates the rate.
    fetchOrderById.mockResolvedValue(anOrder());
    renderWithOrderId(auth({ user, isAuthenticated: true }));

    await screen.findByText('Shipping');
    expect(screen.getByText(/Tax \(8\.05%\)/)).toBeInTheDocument();
  });

  it('shows the order without waiting for a webhook', async () => {
    fetchOrderById.mockResolvedValue(anOrder());
    renderWithOrderId(auth({ user, isAuthenticated: true }));

    expect(await screen.findByText(/order placed/i)).toBeInTheDocument();
    expect(fetchOrder, 'polled for a payment intent that does not exist').not.toHaveBeenCalled();
  });

  it('empties the cart, since the order really was created', async () => {
    fetchOrderById.mockResolvedValue(anOrder());
    renderWithOrderId(auth({ user, isAuthenticated: true }));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });
});
