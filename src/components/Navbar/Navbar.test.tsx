import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from './Navbar';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';
import { useCartSideBar } from '../../context/useCartSideBar';

/** Surfaces the sidebar's open flag - the Navbar toggles it but does not
 * render the sidebar itself. */
function CartOpenProbe() {
  const { isOpen } = useCartSideBar();
  return <span data-testid="cart-open">{String(isOpen)}</span>;
}

// The destination is the whole point of this change, so it is asserted rather
// than inferred from what happens to render afterwards.
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('Navbar', () => {
  describe('the cart button when signed out', () => {
    it('does not route anywhere', async () => {
      // The original bug: this navigated to "/signin", a route that has never
      // existed - sign-in is Cognito's hosted UI - so it landed on the 404 page.
      renderWithProviders(<Navbar />, { user: null });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('opens the sidebar - the basket is local-first and open to guests', async () => {
      // It used to gate on `!user` and show "please sign in to see your cart",
      // from when the basket lived on the server. A guest now has a real local
      // basket, and this is how they get to it.
      const signIn = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(
        <>
          <Navbar />
          <CartOpenProbe />
        </>,
        { user: null, authValue: { signIn } },
      );

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.getByTestId('cart-open')).toHaveTextContent('true');
      expect(signIn).not.toHaveBeenCalled();
    });
  });

  describe('the cart button when signed in', () => {
    it('opens the sidebar', async () => {
      renderWithProviders(
        <>
          <Navbar />
          <CartOpenProbe />
        </>,
        { user: createMockUser() },
      );

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.getByTestId('cart-open')).toHaveTextContent('true');
    });
  });

  it('renders a Sign in button when signed out', () => {
    renderWithProviders(<Navbar />, { user: null });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends an admin to the dashboard, not straight to the products list', async () => {
    /*
     * /admin has always rendered the dashboard; this button was the one thing
     * routing past it, so the queue counts, the card-hold warnings and the
     * day's takings were only seen by someone who edited the URL.
     */
    const admin = createMockUser({ name: 'Ada Admin', roles: ['Admin'] });
    renderWithProviders(<Navbar />, { user: admin });

    await userEvent.click(screen.getByRole('button', { name: /ada admin/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Admin' }));

    expect(navigate).toHaveBeenCalledWith('/admin');
  });
});
