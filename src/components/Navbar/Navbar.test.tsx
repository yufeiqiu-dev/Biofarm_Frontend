import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from './Navbar';
import { createMockAuthValue, renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';

describe('Navbar', () => {
  describe('the cart button when signed out', () => {
    it('starts sign-in rather than routing to a page that does not exist', async () => {
      // The regression: this navigated to "/signin", which is not in the route
      // table and never was - sign-in is Cognito's hosted UI. Clicking the cart
      // while signed out therefore landed on the 404 page.
      const signIn = vi.fn().mockResolvedValue(undefined);
      const authValue = { ...createMockAuthValue(null), signIn };

      renderWithProviders(<Navbar />, { user: null, authValue });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(signIn).toHaveBeenCalledTimes(1);
    });

    it('does not open the cart sidebar, which would be empty anyway', async () => {
      // The cart is stored per user and cleared on sign-out, so there is
      // nothing for a signed-out shopper to look at.
      const authValue = { ...createMockAuthValue(null), signIn: vi.fn().mockResolvedValue(undefined) };
      renderWithProviders(<Navbar />, { user: null, authValue });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(screen.queryByRole('heading', { name: 'Cart' })).not.toBeInTheDocument();
    });
  });

  describe('the cart button when signed in', () => {
    it('opens the sidebar instead of starting sign-in', async () => {
      const signIn = vi.fn().mockResolvedValue(undefined);
      const authValue = { ...createMockAuthValue(createMockUser()), signIn };

      renderWithProviders(<Navbar />, { user: createMockUser(), authValue });

      await userEvent.click(screen.getByRole('button', { name: /cart/i }));

      expect(signIn).not.toHaveBeenCalled();
    });
  });

  it('renders a Sign in button when signed out', () => {
    renderWithProviders(<Navbar />, { user: null });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
