import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    authorization_days_remaining: 5,
    card_brand: 'visa',
    card_last4: '4242',
    shipping_name: 'Jane Smith',
    shipping_address1: '123 Main St',
    shipping_city: 'Springfield',
    shipping_state: 'IL',
    shipping_zip: '62701',
    items: [],
  };
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
    getOrder.mockReset().mockResolvedValue(anOrder() as never);
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

/*
 * Shipping is charged now, so every place a total is shown has to include it -
 * and show the line. A total that does not match its own rows is an admin
 * reconciling against Stripe and finding a difference with no explanation.
 */
describe('AdminOrderDetailPage shipping', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getAccount.mockReset().mockRejectedValue(new ApiError('no account', 404));
  });

  function render() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('shows shipping as its own line and in the total', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      items: [
        {
          id: 'i1',
          variant_id: 'v1',
          product_name: 'Anti-Tau',
          variant_label: '50 ug',
          unit_price: 100,
          quantity: 1,
        },
      ],
      // create_order writes total_amount as exactly the line sum, so a fixture
      // where they disagree is not a state the backend can produce.
      total_amount: 100,
      tax_amount: 8.75,
      shipping_amount: 25,
    } as never);

    render();

    expect(await screen.findByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    // 100 + 25 + 8.75
    expect(screen.getByText('$133.75')).toBeInTheDocument();
  });

  it('omits the line on an order placed before shipping was charged', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      items: [
        {
          id: 'i1',
          variant_id: 'v1',
          product_name: 'Anti-Tau',
          variant_label: '50 ug',
          unit_price: 100,
          quantity: 1,
        },
      ],
      total_amount: 100,
      tax_amount: 0,
      shipping_amount: 0,
    } as never);

    render();

    await screen.findByText(/1042/);
    expect(screen.queryByText('Shipping')).not.toBeInTheDocument();
    // Subtotal and Total both read $100.00 with nothing added, so getByText
    // would throw on the duplicate rather than assert anything.
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(2);
  });
});

/*
 * Checkout only authorises; the money is captured when the order ships. Stripe
 * releases an uncaptured hold after about a week, and a released hold cannot be
 * captured - so the capture fails at ship time with the goods packed and the
 * stock long since deducted. Nothing counted those days.
 */
describe('AdminOrderDetailPage card hold', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getAccount.mockReset().mockRejectedValue(new ApiError('no account', 404));
  });

  function render() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('says how long is left', async () => {
    // Rounded up: 5.4 days remaining is "6d". See the last-day case below for
    // why rounding down was wrong.
    getOrder.mockResolvedValue({ ...anOrder(), authorization_days_remaining: 5.4 } as never);
    render();

    expect(await screen.findByText(/expires in 6d/i)).toBeInTheDocument();
  });

  it('never says 0d while the hold is still alive', async () => {
    // Math.floor collapsed the whole final day to "0d" - which reads as already
    // expired, the one state the page words differently on purpose. An order
    // with hours left was indistinguishable from one already dead.
    getOrder.mockResolvedValue({ ...anOrder(), authorization_days_remaining: 0.15 } as never);
    render();

    expect(await screen.findByText(/expires in 1d/i)).toBeInTheDocument();
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  it('does not render NaN when the field is absent', async () => {
    // A frontend deployed ahead of its backend gets a 200 with no such field.
    // The guard was `!== null`, which lets undefined through to Math.floor.
    const withoutField: Record<string, unknown> = { ...anOrder() };
    delete withoutField.authorization_days_remaining;
    getOrder.mockResolvedValue(withoutField as never);
    render();

    await screen.findByText(/1042/);
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/card hold/i)).not.toBeInTheDocument();
  });

  it('says plainly when the capture will fail', async () => {
    // Not "expires in 0d" - the money is already gone and shipping will error.
    getOrder.mockResolvedValue({ ...anOrder(), authorization_days_remaining: -2.1 } as never);
    render();

    expect(await screen.findByText(/expired — capture will fail/i)).toBeInTheDocument();
  });

  it('shows nothing once the money has moved', async () => {
    // A shipped order was captured; there is no hold left to lapse.
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'shipped',
      authorization_days_remaining: null,
    } as never);
    render();

    await screen.findByText(/1042/);
    expect(screen.queryByText(/card hold/i)).not.toBeInTheDocument();
  });
});

/*
 * Confirming captures the payment now, so the dialog has to say so. Backing out
 * afterwards is a refund on which Stripe keeps its fee, not a free void - the
 * admin is committing to ship, and should know that before clicking.
 */
describe('AdminOrderDetailPage confirm dialog', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getAccount.mockReset().mockRejectedValue(new ApiError('no account', 404));
  });

  function render() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('says the customer is charged now, with the amount', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      total_amount: 285,
      shipping_amount: 25,
      tax_amount: 24.94,
    } as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /confirm order/i }));

    // 285 + 25 + 24.94
    expect(await screen.findByText(/charges the customer \$334\.94 now/i)).toBeInTheDocument();
  });

  it('spells out that backing out costs the fee', async () => {
    getOrder.mockResolvedValue(anOrder() as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /confirm order/i }));

    expect(await screen.findByText(/payment fee is not returned/i)).toBeInTheDocument();
    expect(screen.getByText(/committing to send it/i)).toBeInTheDocument();
  });
});

/*
 * The console branches on captured_at, not on status. Status meant opposite
 * things either side of the capture moving to confirm, and deriving from it left
 * the cancel dialog promising "no charge has been made" about a charged order.
 */
describe('AdminOrderDetailPage cancel wording', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getAccount.mockReset().mockRejectedValue(new ApiError('no account', 404));
  });

  function render() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('offers a refund on a confirmed order that was charged', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'confirmed',
      captured_at: '2026-09-06T10:00:00Z',
    } as never);
    render();

    expect(await screen.findByRole('button', { name: /cancel \+ refund/i })).toBeInTheDocument();
  });

  it('does not claim no charge was made once the card was charged', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'confirmed',
      captured_at: '2026-09-06T10:00:00Z',
    } as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /cancel \+ refund/i }));
    expect(screen.queryByText(/no charge has been made/i)).not.toBeInTheDocument();
  });

  it('still offers a plain cancel before anything is charged', async () => {
    // A void is free; a refund is not. An uncharged order must not cost a fee.
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'awaiting_fulfillment',
      captured_at: null,
    } as never);
    render();

    expect(await screen.findByRole('button', { name: /^cancel order$/i })).toBeInTheDocument();
  });

  it('does not promise no charge was made on an order that may be charged', async () => {
    /*
     * release_funds does not branch on captured_at alone - it attempts the void
     * and refunds if Stripe says the money already moved. A confirm that
     * captured and then rolled back leaves the order reading
     * awaiting_fulfillment with captured_at NULL, so the flat claim was made on
     * exactly the click that issues a refund. The customer's own dialog was
     * reworded for this; both sides of the till say the same thing now.
     */
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'awaiting_fulfillment',
      captured_at: null,
    } as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /^cancel order$/i }));
    expect(screen.queryByText(/no charge has been made/i)).not.toBeInTheDocument();
    expect(screen.getByText(/we will refund it; otherwise the hold is released/i)).toBeInTheDocument();
  });

  it('does not tell the admin that shipping captures payment', async () => {
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'confirmed',
      captured_at: '2026-09-06T10:00:00Z',
    } as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /mark shipped/i }));
    expect(screen.queryByText(/will capture payment/i)).not.toBeInTheDocument();
    expect(screen.getByText(/already charged when you confirmed/i)).toBeInTheDocument();
  });

  it('does not claim a legacy confirmed order was already charged', async () => {
    // Confirmed under the old rule, so nothing was captured then. The backend's
    // ship branch captures on this very click, which makes "already charged"
    // the one wrong thing to say on the one screen where it matters.
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'confirmed',
      captured_at: null,
    } as never);
    render();

    await userEvent.click(await screen.findByRole('button', { name: /mark shipped/i }));
    expect(screen.queryByText(/already charged when you confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/charges them now/i)).toBeInTheDocument();
  });
});

describe('AdminOrderDetailPage cancel wording under version skew', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getAccount.mockReset().mockRejectedValue(new ApiError('no account', 404));
  });

  function render() {
    return renderWithProviders(<AdminOrderDetailPage />, {
      user: createMockAdminUser(),
      initialEntries: ['/admin/orders/o1'],
    });
  }

  it('falls back to the old rule when the backend does not send the field', async () => {
    // captured_at is optional because a frontend can ship ahead of its backend.
    // Reading that absence as "not charged" put "No charge has been made" back
    // over a delivered order that the old backend would refund.
    const withoutField: Record<string, unknown> = { ...anOrder(), status: 'delivered' };
    delete withoutField.captured_at;
    getOrder.mockResolvedValue(withoutField as never);
    render();

    expect(await screen.findByRole('button', { name: /cancel \+ refund/i })).toBeInTheDocument();
  });

  it('still offers a plain cancel for an early order on an old backend', async () => {
    const withoutField: Record<string, unknown> = {
      ...anOrder(),
      status: 'awaiting_fulfillment',
    };
    delete withoutField.captured_at;
    getOrder.mockResolvedValue(withoutField as never);
    render();

    expect(await screen.findByRole('button', { name: /^cancel order$/i })).toBeInTheDocument();
  });

  it('treats an explicit null on a shipped order as charged', async () => {
    // The migration leaves captured_at NULL on every pre-existing row, so a new
    // backend serves a legacy shipped order as null - not undefined. Only
    // undefined fell back, which put "No charge has been made" over an order the
    // customer was charged for.
    getOrder.mockResolvedValue({
      ...anOrder(),
      status: 'shipped',
      captured_at: null,
    } as never);
    render();

    expect(await screen.findByRole('button', { name: /cancel \+ refund/i })).toBeInTheDocument();
  });
});
