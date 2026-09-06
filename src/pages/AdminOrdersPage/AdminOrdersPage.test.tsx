import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AdminOrdersPage } from './AdminOrdersPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
import type { AdminOrder } from '../../types/order_types';

vi.mock('../../api/admin_order', () => ({ adminListOrders: vi.fn() }));

const { adminListOrders } = await import('../../api/admin_order');

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 'o1',
    order_number: '4827193056',
    status: 'confirmed',
    total_amount: 19.99,
    tax_amount: 1.75,
    card_brand: 'visa',
    card_last4: '4242',
    shipping_name: 'Jane Smith',
    shipping_phone: '5551234567',
    shipping_address1: '123 Main St',
    shipping_address2: null,
    shipping_city: 'Springfield',
    shipping_state: 'IL',
    shipping_zip: '62701',
    notes: null,
    tracking_number: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    items: [],
    user_id: 'u1',
    customer_email: 'jane@example.com',
    stripe_payment_intent_id: 'pi_1',
    ...overrides,
  };
}

/** The endpoint returns a page now, not a bare array. */
function page(orders: AdminOrder[], total = orders.length) {
  return { items: orders, total, limit: 50, offset: 0 };
}

describe('AdminOrdersPage', () => {

  it('adds tax to the total without coercing, because money is a JSON number', async () => {
    vi.mocked(adminListOrders).mockResolvedValue(page([makeOrder()]));
    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });

    // 19.99 + 1.75. If either arrived as a string this renders "19.991.75".
    expect(await screen.findByText('$21.74')).toBeInTheDocument();
  });

  it('does not let a slow earlier tab overwrite the tab now selected', async () => {
    // The race the cleanup flag closes. Without it, switching tabs left two
    // requests in flight and whichever answered last won - so clicking through
    // the tabs could leave Confirmed's orders showing under Delivered, with
    // nothing on screen to suggest anything was wrong.
    //
    // Every deferred created here is settled before the test ends; leaving one
    // pending hangs Testing Library's cleanup.
    const pending: {
      tab: string | undefined;
      resolve: (o: ReturnType<typeof page>) => void;
    }[] = [];
    vi.mocked(adminListOrders).mockImplementation(
      (query = {}) =>
        new Promise((resolve) => pending.push({ tab: query.status, resolve }))
    );

    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });
    await waitFor(() => expect(pending).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Delivered' }));
    await waitFor(() => expect(pending).toHaveLength(2));

    const awaiting = pending.find((p) => p.tab === 'awaiting_fulfillment')!;
    const delivered = pending.find((p) => p.tab === 'delivered')!;

    // The tab the user has since left answers last, and must be ignored.
    await act(async () => {
      delivered.resolve(
        page([makeOrder({ id: 'o-new', order_number: '7391028465', status: 'delivered' })]),
      );
    });
    await act(async () => {
      awaiting.resolve(
        page([
          makeOrder({ id: 'o-stale', order_number: '5162839407', status: 'awaiting_fulfillment' }),
        ]),
      );
    });

    expect(screen.getByText('#7391028465')).toBeInTheDocument();
    expect(screen.queryByText('#5162839407')).not.toBeInTheDocument();
  });

  it('claims nothing about the orders while the response is in flight', async () => {
    // Asserting on behaviour rather than on the word "Loading...", which was the
    // placeholder this page used before it adopted the shared loading state.
    // That state deliberately draws nothing for the first 250ms, so a load
    // faster than a quarter second never flashes a spinner - which means the
    // durable property is what is *not* shown: no table, and no "no orders"
    // empty state, since either would read as a definite answer.
    let resolve!: (body: ReturnType<typeof page>) => void;
    vi.mocked(adminListOrders).mockReturnValue(new Promise((r) => { resolve = r; }));

    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/no orders found/i)).not.toBeInTheDocument();

    await act(async () => { resolve(page([makeOrder()])); });

    expect(screen.getByRole('table')).toBeInTheDocument();
  });


  it('asks the server to search, rather than filtering the page it happens to hold', async () => {
    // The trap this closes. Search used to filter the orders already fetched,
    // which was correct only while the endpoint returned every order. Against a
    // page, that filter searches one page and reports nothing for the rest -
    // indistinguishable from "no matches".
    vi.mocked(adminListOrders).mockResolvedValue(page([makeOrder()]));
    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });
    await screen.findByText('$21.74');

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'tau-441' },
    });

    await waitFor(() => {
      expect(vi.mocked(adminListOrders)).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'tau-441' }),
      );
    });
  });

  it('goes back to the first page when the search changes', async () => {
    // Searching from page three would otherwise ask for offset 100 of a
    // two-row result and render an empty page that reads as "no matches".
    vi.mocked(adminListOrders).mockResolvedValue(page([makeOrder()], 500));
    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });
    await screen.findByText('$21.74');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(vi.mocked(adminListOrders)).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 50 }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'anything' },
    });

    await waitFor(() =>
      expect(vi.mocked(adminListOrders)).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'anything', offset: 0 }),
      ),
    );
  });

  it('surfaces a failure instead of showing an empty list', async () => {
    vi.mocked(adminListOrders).mockImplementation(async () => {
      throw new Error('backend unreachable');
    });
    renderWithProviders(<AdminOrdersPage />, { user: createMockAdminUser() });

    expect(await screen.findByText(/backend unreachable/)).toBeInTheDocument();
  });
});
