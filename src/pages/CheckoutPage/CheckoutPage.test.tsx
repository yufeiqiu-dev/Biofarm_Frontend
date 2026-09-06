import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from './CheckoutPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';
import { setupLocalStorageStub } from '../../test/localStorageStub';

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
    // The page redirects to /cart when the cart is empty, so it needs one.
    localStorage.setItem(
      `cart:${user.user_id}`,
      JSON.stringify([
        { id: 'p1-v1', productId: 'p1', variantId: 'v1', name: 'Anti-Tau', imageUrl: '', catalogNumber: 'AB-101-50', sizeLabel: '50ug', unitPrice: 285, quantity: 1 },
      ]),
    );
    createIntent.mockReset();
    createIntent.mockResolvedValue({
      client_secret: 'cs_test',
      order_id: 'o1',
      subtotal_cents: 28500,
      tax_amount_cents: 2494,
    } as never);
  });

  function open() {
    return renderWithProviders(<CheckoutPage />, {
      user,
      initialEntries: ['/checkout'],
    });
  }

  it('is prefilled with the account address', async () => {
    open();
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue(user.email);
    });
  });

  it('can be changed to somewhere else', async () => {
    open();
    const field = screen.getByLabelText(/email/i);
    await waitFor(() => expect(field).toHaveValue(user.email));

    await userEvent.clear(field);
    await userEvent.type(field, 'purchasing@lab.edu');

    expect(field).toHaveValue('purchasing@lab.edu');
  });

  it('will not continue with a malformed address', async () => {
    open();
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
    open();
    const field = screen.getByLabelText(/email/i);
    await waitFor(() => expect(field).toHaveValue(user.email));

    await userEvent.clear(field);
    await userEvent.type(field, 'purchasing@lab.edu');
    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await userEvent.type(screen.getByLabelText(/phone/i), '5551234567');

    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });
});
