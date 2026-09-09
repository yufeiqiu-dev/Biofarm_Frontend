import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from './Navbar';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';

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
      const showReminder = vi.fn();
      renderWithProviders(<Navbar />, { user: null, reminderValue: { showReminder } });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    });

    it('explains what is needed instead of redirecting away', async () => {
      // Redirecting straight to the hosted UI was the obvious repair and was
      // worse - a click on the cart icon threw the shopper out to an external
      // page without asking. AddToCartButton already handled this by saying so
      // and leaving them where they are; this matches it.
      const signIn = vi.fn().mockResolvedValue(undefined);
      const showReminder = vi.fn();

      renderWithProviders(<Navbar />, {
        user: null,
        authValue: { signIn },
        reminderValue: { showReminder },
      });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/sign in/i) }),
      );
      expect(signIn).not.toHaveBeenCalled();
    });

    it('does not open the sidebar, which would be empty anyway', async () => {
      // The cart is stored per user and cleared on sign-out.
      renderWithProviders(<Navbar />, { user: null, reminderValue: { showReminder: vi.fn() } });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.queryByRole('heading', { name: 'Cart' })).not.toBeInTheDocument();
    });
  });

  describe('the cart button when signed in', () => {
    it('opens the sidebar and says nothing', async () => {
      const showReminder = vi.fn();
      renderWithProviders(<Navbar />, {
        user: createMockUser(),
        reminderValue: { showReminder },
      });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(showReminder).not.toHaveBeenCalled();
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
