import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { syncCart } from '../api/cart';
import { setupLocalStorageStub } from '../test/localStorageStub';

/*
 * Sign-out is the one moment CartSideBarContext cannot handle on its own: it
 * flushes the departing account's basket to the server and clears this
 * device's local copy of it, both here rather than reactively from a change in
 * `user` - this is the last point the access token is still valid.
 * amplifySignOut() below is a full-page redirect through Cognito's hosted
 * logout page, so by the time any component next reads `user`, the whole
 * provider tree has already been torn down and rebuilt with nothing left to
 * flush against.
 */
function Probe() {
  const { user, loading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.user_id ?? 'none'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => void signOut()}>sign out</button>
    </div>
  );
}

function signedInUser(overrides: { userId?: string } = {}) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    userId: overrides.userId ?? 'user-1',
    username: 'alice@lab.edu',
  } as never);
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: {
      accessToken: { toString: () => 'access-token', payload: {} },
      idToken: { toString: () => 'id-token', payload: { email: 'alice@lab.edu' } },
    },
  } as never);
}

function aLine(overrides: Record<string, unknown> = {}) {
  return {
    variantId: 'v1',
    productId: 'p1',
    name: 'Anti-Tau',
    imageUrl: '',
    catalogNumber: 'AB-101',
    sizeLabel: '50ug',
    unitPrice: 285,
    quantity: 2,
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AuthContext signOut', () => {
  setupLocalStorageStub();

  beforeEach(() => {
    signedInUser();
    vi.mocked(syncCart).mockResolvedValue({ items: [], subtotal: 0, unavailable: [] });
  });

  async function renderSignedIn() {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user-1'));
  }

  it('pushes this device\'s basket before the redirect that invalidates the token', async () => {
    localStorage.setItem('cart:user-1', JSON.stringify([aLine()]));
    await renderSignedIn();

    const order: string[] = [];
    vi.mocked(syncCart).mockImplementation(async () => {
      order.push('syncCart');
      return { items: [], subtotal: 0, unavailable: [] };
    });
    vi.mocked(amplifySignOut).mockImplementation(async () => {
      order.push('amplifySignOut');
    });

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(order).toEqual(['syncCart', 'amplifySignOut']);
    expect(vi.mocked(syncCart)).toHaveBeenCalledWith([
      expect.objectContaining({ variant_id: 'v1', quantity: 2, deleted: false }),
    ]);
  });

  it('clears this device\'s copy of that account\'s basket, win or lose', async () => {
    localStorage.setItem('cart:user-1', JSON.stringify([aLine()]));
    await renderSignedIn();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(localStorage.getItem('cart:user-1')).toBeNull());
  });

  it('still clears local storage when the flush itself fails', async () => {
    // Best effort: a push that cannot reach the server must not leave the
    // account's basket sitting in this browser's storage regardless.
    localStorage.setItem('cart:user-1', JSON.stringify([aLine()]));
    vi.mocked(syncCart).mockRejectedValue(new Error('offline'));
    await renderSignedIn();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(localStorage.getItem('cart:user-1')).toBeNull());
    expect(vi.mocked(amplifySignOut)).toHaveBeenCalled();
  });

  it('does not touch a leftover guest basket', async () => {
    localStorage.setItem('cart:guest', JSON.stringify([aLine()]));
    await renderSignedIn();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(vi.mocked(amplifySignOut)).toHaveBeenCalled());
    expect(localStorage.getItem('cart:guest')).not.toBeNull();
  });

  it('does not push when there is nothing saved for this account', async () => {
    await renderSignedIn();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(vi.mocked(amplifySignOut)).toHaveBeenCalled());
    expect(syncCart).not.toHaveBeenCalled();
  });

  it('signs out cleanly with no account to flush', async () => {
    // A visitor who was never signed in still has a working sign-out - nothing
    // here should assume `user` is set.
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('no session'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(syncCart).not.toHaveBeenCalled();
    await waitFor(() => expect(vi.mocked(amplifySignOut)).toHaveBeenCalled());
  });
});
