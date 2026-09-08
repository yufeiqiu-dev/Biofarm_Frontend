import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { OrdersPage } from './OrdersPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser } from '../../test/mocks/mockUser';
import type { Order } from '../../types/order_types';

vi.mock('../../api/order', () => ({ getMyOrders: vi.fn() }));

const { getMyOrders } = await import('../../api/order');

function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    order_number: '4827193056',
    status: 'awaiting_fulfillment',
    total_amount: 24.99,
    shipping_amount: 5.99,
    tax_amount: 2.71,
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
 * This row is one of three customer-facing money surfaces, and it has to agree
 * with the other two. It dropped the shipping fee, so a customer saw one figure
 * in My Orders and a larger one on the order they tapped through to - for the
 * same order, neither of them explained.
 */
describe('OrdersPage totals', () => {
  beforeEach(() => {
    vi.mocked(getMyOrders).mockReset();
  });

  it('includes shipping, so it matches the order detail page', async () => {
    vi.mocked(getMyOrders).mockResolvedValue([anOrder()]);
    renderWithProviders(<OrdersPage />, { user: createMockUser() });

    // 24.99 + 5.99 + 2.71 — what the card was actually charged.
    expect(await screen.findByText('$33.69')).toBeInTheDocument();
    expect(screen.queryByText('$27.70')).not.toBeInTheDocument();
  });

  it('handles an order placed before shipping was charged', async () => {
    vi.mocked(getMyOrders).mockResolvedValue([anOrder({ shipping_amount: 0 })]);
    renderWithProviders(<OrdersPage />, { user: createMockUser() });

    expect(await screen.findByText('$27.70')).toBeInTheDocument();
  });
});
