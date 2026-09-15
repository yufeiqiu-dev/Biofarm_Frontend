import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';
import { setupLocalStorageStub } from '../../test/localStorageStub';
import { getCart } from '../../api/cart';

vi.mock('../../api/order', () => ({
  createPaymentIntent: vi.fn(),
}));

const createIntent = vi.mocked(
  (await import('../../api/order')).createPaymentIntent,
);

// email is optional on User and the shared mock omits it; this page is about it.
const user = createMockUser({ email: 'alice@lab.edu' });

/*
 * The contact address, which the customer now chooses.
 *
 * It used to be a disabled input showing the Cognito account's email. That
 * blocked checkout outright for an account with no email, and gave a lab
 * ordering against a shared purchasing address no way to say so. Order mail is
 * a notification and never a credential - every order is scoped by the Cognito
 * sub, and knowing an address reaches nothing - so the customer's word is good
 * enough for where it goes. A blank field still falls back to the verified
 * account address, server side.
 */
describe('CheckoutPage contact email', () => {
  setupLocalStorageStub();

  beforeEach(() => {
    // The page redirects to /cart when the basket is empty, so it needs one -
    // from the server now, which is also why the redirect had to move out of
    // render: the basket is briefly empty on every first paint.
    vi.mocked(getCart).mockResolvedValue({
      items: [
        {
          variant_id: 'v1', product_id: 'p1', name: 'Anti-Tau',
          catalog_number: 'AB-101-50', size_label: '50ug', image_url: '',
          unit_price: 285, quantity: 1, available: 5, over_stock: false,
          client_updated_at: '2020-01-01T00:00:00.000Z',
        },
      ],
      subtotal: 285,
      unavailable: [],
    });
    createIntent.mockReset();
    createIntent.mockResolvedValue({
      client_secret: 'cs_test',
      order_id: 'o1',
      subtotal_cents: 28500,
      tax_amount_cents: 2494,
    } as never);
  });

  /*
   * Renders and waits for the basket.
   *
   * The wizard is behind a loading state now: the basket comes from the server,
   * so the first paint of every checkout has no items yet. Reading a field
   * straight after render finds nothing.
   */
  async function open() {
    const rendered = renderWithProviders(<CheckoutPage />, {
      user,
      initialEntries: ['/checkout'],
    });
    await screen.findByLabelText(/email/i);
    return rendered;
  }

  it('is prefilled with the account address', async () => {
    await open();
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue(user.email);
    });
  });

  it('can be changed to somewhere else', async () => {
    await open();
    const field = screen.getByLabelText(/email/i);
    await waitFor(() => expect(field).toHaveValue(user.email));

    await userEvent.clear(field);
    await userEvent.type(field, 'purchasing@lab.edu');

    expect(field).toHaveValue('purchasing@lab.edu');
  });

  it('will not continue with a malformed address', async () => {
    await open();
    const field = screen.getByLabelText(/email/i);
    await waitFor(() => expect(field).toHaveValue(user.email));

    await userEvent.clear(field);
    await userEvent.type(field, 'not-an-address');
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await userEvent.type(screen.getByLabelText(/phone/i), '5551234567');

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
  });

  it('continues once the address is valid', async () => {
    await open();
    const field = screen.getByLabelText(/email/i);
    await waitFor(() => expect(field).toHaveValue(user.email));

    await userEvent.clear(field);
    await userEvent.type(field, 'purchasing@lab.edu');
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await userEvent.type(screen.getByLabelText(/phone/i), '5551234567');

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  /*
   * The basket arrives a tick after the page does, now that it is fetched.
   *
   * Redirecting during render was survivable while it came out of localStorage
   * synchronously - it was never briefly empty. Once it is fetched, the first
   * render of every checkout has no items, and navigating from render put React
   * into an infinite update loop: render, navigate, render. It took a worker
   * process down with 200,000 errors before it took the customer anywhere.
   */
  it('waits for the basket instead of bouncing off an empty one', async () => {
    let resolve: (value: never) => void = () => {};
    vi.mocked(getCart).mockReturnValue(new Promise((r) => { resolve = r; }) as never);

    renderWithProviders(<CheckoutPage />, { user, initialEntries: ['/checkout'] });

    // Still here, and no loop. The wizard is not rendered against an empty
    // basket either, which would flash a $0.00 order.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    await act(async () => {
      resolve({ items: [], subtotal: 0, unavailable: [] } as never);
    });
  });

  it('sends a genuinely empty basket to the cart page', async () => {
    // Once we know it is empty, rather than before we know anything.
    vi.mocked(getCart).mockResolvedValue({ items: [], subtotal: 0, unavailable: [] });

    renderWithProviders(<CheckoutPage />, { user, initialEntries: ['/checkout'] });

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});
