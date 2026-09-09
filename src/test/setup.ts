import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
  },
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
  getCurrentUser: vi.fn().mockResolvedValue({ userId: 'mock-user-id', username: 'mock@example.com' }),
  signInWithRedirect: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

/*
 * The cart lives on the server, so rendering CartSideBarProvider is a request.
 *
 * Mocked globally for the same reason aws-amplify is: a component test that
 * merely happens to sit inside the provider should not reach the network, and
 * without this every one of them would fail on an unconfigured session getter.
 *
 * `getCart` answers with an empty basket. The writes resolve with nothing,
 * which the provider reads as "no server echo, keep what is on screen" - so an
 * optimistic add stays visible, which is what a component test asserting on the
 * cart is actually interested in. A test that cares about the server's reply
 * mocks this module itself; a local vi.mock takes precedence.
 */
vi.mock('../api/cart', () => ({
  getCart: vi.fn().mockResolvedValue({ items: [], subtotal: 0, unavailable: [] }),
  setCartLine: vi.fn().mockResolvedValue(undefined),
  removeCartLine: vi.fn().mockResolvedValue(undefined),
  clearServerCart: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
});
