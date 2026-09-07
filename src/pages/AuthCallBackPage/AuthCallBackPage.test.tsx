import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { AuthCallBackPage } from './AuthCallBackPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
}));

/*
 * Where sign-in sends you afterwards.
 *
 * The path is whatever was in sessionStorage when signIn() was called, and that
 * came from window.location - so an attacker who can get someone to start
 * sign-in from a URL of their choosing controls it. `startsWith("/")` is the
 * classic insufficient check: "//evil.com" is protocol-relative and passes it,
 * as does "/\\evil.com", which browsers normalise the same way.
 *
 * The consequence is worse than an ordinary open redirect: this lands
 * immediately after authentication, so the destination is exactly where someone
 * expects to arrive signed in - which is what makes a credential-phishing page
 * there convincing.
 */
describe('AuthCallBackPage redirect target', () => {
  beforeEach(() => {
    navigate.mockClear();
    sessionStorage.clear();
  });

  async function landsOn(stored: string | null) {
    if (stored !== null) sessionStorage.setItem('RedirectPath', stored);
    renderWithProviders(<AuthCallBackPage />, { initialEntries: ['/auth/callback'] });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    return navigate.mock.calls[0][0];
  }

  it('goes where the customer was, on an ordinary path', async () => {
    expect(await landsOn('/orders/123')).toBe('/orders/123');
  });

  it('falls back to home with nothing stored', async () => {
    expect(await landsOn(null)).toBe('/');
  });

  it('refuses a protocol-relative url', async () => {
    // Passes startsWith("/") and resolves to https://example.com
    expect(await landsOn('//example.com')).toBe('/');
  });

  it('refuses a backslash-prefixed url', async () => {
    // Browsers normalise \ to / in the authority position
    expect(await landsOn('/\\example.com')).toBe('/');
  });

  it('refuses an absolute url', async () => {
    expect(await landsOn('https://example.com/phish')).toBe('/');
  });

  it('refuses a javascript: url', async () => {
    expect(await landsOn('javascript:alert(1)')).toBe('/');
  });

  it('refuses a tab-obfuscated protocol-relative url', async () => {
    // Browsers strip tab/newline/CR before parsing, so this becomes //evil.com
    expect(await landsOn('/	/example.com')).toBe('/');
  });

  it('keeps a query string and hash, which are legitimate', async () => {
    expect(await landsOn('/products?tag=antibody#top')).toBe('/products?tag=antibody#top');
  });

  it('consumes the stored path rather than leaving it behind', async () => {
    // One-shot. Left behind, the next person to sign in on this tab inherits
    // the last one's destination - including an admin page they cannot open.
    await landsOn('/orders/123');
    expect(sessionStorage.getItem('RedirectPath')).toBeNull();
  });

  it('sends an admin who just signed out to the home page', async () => {
    // signOut clears the key, so the callback has nothing to return them to.
    // It used to store the current path, so signing out of /admin/orders went
    // straight back there - where AdminRoute refused them and the sign-out
    // ended on "Unauthorized. Admin user required."
    expect(await landsOn(null)).toBe('/');
  });
});
