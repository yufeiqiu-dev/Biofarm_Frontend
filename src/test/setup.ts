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
 * The cart is local-first (see CartSideBarContext), but the provider still
 * pulls from and pushes to the server at its sync points, so rendering it is
 * still a request.
 *
 * Mocked globally for the same reason aws-amplify is: a component test that
 * merely happens to sit inside the provider should not reach the network, and
 * without this every one of them would fail on an unconfigured session getter.
 * `getCart` answers with an empty basket, so the provider's own pull-and-merge
 * has nothing to merge in and leaves localStorage's copy alone; `syncCart`
 * resolves without a component test needing to care what it echoes back, since
 * a push's response is never written back into what is on screen. A test that
 * cares about either call mocks this module itself; a local vi.mock takes
 * precedence.
 */
vi.mock('../api/cart', () => ({
  getCart: vi.fn().mockResolvedValue({ items: [], subtotal: 0, unavailable: [], deleted_lines: [] }),
  syncCart: vi.fn().mockResolvedValue({ items: [], subtotal: 0, unavailable: [], deleted_lines: [] }),
}));

afterEach(() => {
  vi.clearAllMocks();
  // The cart provider now reads and writes real localStorage - without this a
  // basket saved by one test's render is still there for the next test that
  // happens to render the same owner id.
  localStorage.clear();
});
