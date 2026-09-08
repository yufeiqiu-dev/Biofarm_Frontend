import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderDetailPage } from './OrderDetailPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';
import type { Order } from '../../types/order_types';

vi.mock('../../api/order', () => ({
  getMyOrder: vi.fn(),
  cancelMyOrder: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ orderId: 'o1' }) };
});

const { getMyOrder } = await import('../../api/order');

function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    order_number: '4827193056',
    status: 'awaiting_fulfillment',
    total_amount: 19.99,
    tax_amount: 1.75,
    shipping_amount: 0,
    card_brand: 'visa',
    card_last4: '4242',
    shipping_name: 'Jane Doe',
    shipping_phone: '555-0100',
    shipping_address1: '1 Test St',
    shipping_address2: null,
    shipping_city: 'Springfield',
    shipping_state: 'CA',
    shipping_zip: '90210',
    notes: null,
    tracking_number: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    items: [],
    ...overrides,
  } as Order;
}

/*
 * The cancel dialog states what happens to the customer's money, so it has to
 * be right in the case where it is surprising - not just the common one.
 */
/*
 * The cancel dialog states what happens to the customer's money, so it has to
 * be right in the case where it is surprising - not just the common one.
 */
describe('OrderDetailPage cancel dialog', () => {
  beforeEach(() => {
    vi.mocked(getMyOrder).mockReset();
  });

  async function openDialog(order: Order) {
    vi.mocked(getMyOrder).mockResolvedValue(order);
    renderWithProviders(<OrderDetailPage />, { user: createMockUser() });
    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }));
  }

  it('does not promise that no charge was made', async () => {
    /*
     * It was almost always true and a flat contradiction of the customer's
     * statement when it was not. Confirm captures and then commits, and a
     * rolled-back commit leaves the money taken with the status unchanged - the
     * backend then discovers the capture and issues a real refund while this
     * screen had promised there was nothing to refund.
     *
     * Branching on captured_at does not fix it: that flag is committed in the
     * same transaction as the status, so the rollback loses both and it reads
     * false in exactly the case it was meant to catch.
     */
    await openDialog(anOrder());

    expect(screen.queryByText(/no charge has been made/i)).not.toBeInTheDocument();
  });

  it('covers both outcomes, since only Stripe knows which happened', async () => {
    await openDialog(anOrder());

    expect(screen.getByText(/already been charged, we will refund it/i)).toBeInTheDocument();
    expect(screen.getByText(/otherwise the hold is released/i)).toBeInTheDocument();
  });
});


/*
 * The three customer-facing money surfaces - this page, the post-purchase
 * receipt and the order history row - must all show the amount Stripe actually
 * charged. Two of them dropped the shipping fee, so the same order read
 * differently depending on which screen you were on.
 */
describe('OrderDetailPage totals', () => {
  beforeEach(() => {
    vi.mocked(getMyOrder).mockReset();
  });

  async function renderOrder(order: Order) {
    vi.mocked(getMyOrder).mockResolvedValue(order);
    renderWithProviders(<OrderDetailPage />, { user: createMockUser() });
    await screen.findByText(/4827193056/);
  }

  it('includes shipping in the total, because the card was charged it', async () => {
    await renderOrder(anOrder({ total_amount: 24.99, shipping_amount: 5.99, tax_amount: 2.71 }));

    expect(screen.getByText('$33.69')).toBeInTheDocument();
  });

  it('rates the tax against goods plus shipping, which is what was taxed', async () => {
    // calculate_tax passes the shipping cost to Stripe Tax because most US
    // states tax delivery. Dividing by the goods alone rendered "10.85%".
    await renderOrder(anOrder({ total_amount: 24.99, shipping_amount: 5.99, tax_amount: 2.71 }));

    expect(screen.getByText(/Tax \(8\.75%\)/)).toBeInTheDocument();
  });

  it('does not render an infinite tax rate', async () => {
    // total_amount alone could be zero with tax present, and the old guard
    // only checked that tax was non-zero.
    await renderOrder(anOrder({ total_amount: 0, shipping_amount: 0, tax_amount: 1 }));

    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });
});

