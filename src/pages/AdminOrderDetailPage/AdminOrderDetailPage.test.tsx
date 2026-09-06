import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { AdminOrderDetailPage } from './AdminOrderDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
import { ApiError } from '../../api/client';

vi.mock('../../api/admin_order', () => ({
  adminGetOrder: vi.fn(),
  adminConfirmOrder: vi.fn(),
  adminShipOrder: vi.fn(),
  adminDeliverOrder: vi.fn(),
  adminCancelOrder: vi.fn(),
  adminUpdateTracking: vi.fn(),
}));

vi.mock('../../api/admin_user', () => ({
  getAdminAccount: vi.fn(),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useParams: () => ({ orderId: 'o1' }),
}));

const getOrder = vi.mocked((await import('../../api/admin_order')).adminGetOrder);
const getAccount = vi.mocked((await import('../../api/admin_user')).getAdminAccount);

const SUB = '11111111-2222-3333-4444-555555555555';

function anOrder() {
  return {
    id: 'o1',
    order_number: 1042,
    user_id: SUB,
    customer_email: 'purchasing@lab.edu',
    status: 'awaiting_fulfillment',
    created_at: new Date('2026-01-04').toISOString(),
    total_amount: 285,
    tax_amount: 24.94,
    card_brand: 'visa',
    card_last4: '4242',
    shipping_name: 'Jane Smith',
    shipping_address1: '123 Main St',
    shipping_city: 'Springfield',
    shipping_state: 'IL',
    shipping_zip: '62701',
    items: [],
  } as never;
}

/*
 * The order carries two different addresses now.
 *
 * customer_email is where the customer asked confirmations to go, which need
 * not be their own - a lab ordering against a shared purchasing address is the
 * ordinary case. So it no longer identifies who placed the order, and user_id
 * on its own is a Cognito sub: a uuid.
 */
describe('AdminOrderDetailPage account lookup', () => {
  beforeEach(() => {
    getOrder.mockReset().mockResolvedValue(anOrder());
    getAccount.mockReset();
  });

  function open() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('names the account behind the sub', async () => {
    getAccount.mockResolvedValue({
      sub: SUB,
      username: 'alice',
      email: 'alice@lab.edu',
      name: 'Alice Chen',
      status: 'CONFIRMED',
      enabled: true,
      created_at: null,
      synthetic: false,
    });

    open();

    expect(await screen.findByText('alice@lab.edu')).toBeInTheDocument();
    // And keeps showing where the mail actually went, which is a different fact.
    expect(screen.getByText('purchasing@lab.edu')).toBeInTheDocument();
  });

  it('says a deleted account is deleted', async () => {
    getAccount.mockRejectedValue(new ApiError('No account with that id', 404));

    open();

    expect(await screen.findByText(/deleted account/i)).toBeInTheDocument();
  });

  it('does not present an unreachable Cognito as a deleted account', async () => {
    // The distinction that matters. Collapsing these would make every customer
    // look deleted the moment the lookup failed.
    getAccount.mockRejectedValue(new ApiError('Could not reach Cognito', 502));

    open();

    expect(await screen.findByText(/could not reach cognito/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted account/i)).not.toBeInTheDocument();
  });

  it('flags a disabled account', async () => {
    getAccount.mockResolvedValue({
      sub: SUB,
      username: 'alice',
      email: 'alice@lab.edu',
      name: '',
      status: 'CONFIRMED',
      enabled: false,
      created_at: null,
      synthetic: false,
    });

    open();

    expect(await screen.findByText(/disabled/i)).toBeInTheDocument();
  });

  it('a failed lookup does not look like a failed order load', async () => {
    getAccount.mockRejectedValue(new ApiError('Could not reach Cognito', 502));

    open();

    await screen.findByText(/could not reach cognito/i);
    // The order itself loaded, so the fulfilment controls must still be usable.
    expect(screen.getByText(/1042/)).toBeInTheDocument();
  });
});
