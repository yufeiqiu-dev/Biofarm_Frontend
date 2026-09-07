import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { AdminDashboardPage } from './AdminDashboardPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockAdminUser } from '../../test/mocks/mockUser';
import type { AdminStats } from '../../api/admin_stats';

vi.mock('../../api/admin_stats', () => ({ getAdminStats: vi.fn() }));
const getStats = vi.mocked((await import('../../api/admin_stats')).getAdminStats);

function stats(overrides: Partial<AdminStats> = {}): AdminStats {
  return {
    timezone: 'America/New_York',
    generated_at: new Date().toISOString(),
    queue: { to_confirm: 0, to_ship: 0, in_transit: 0, oldest_awaiting_hours: null },
    volume: { today: 0, last_7_days: 0, last_30_days: 0, all_time: 0 },
    top_products: [],
    catalogue: {
      products: 6,
      variants: 8,
      low_stock_threshold: 5,
      low_stock_total: 0,
      low_stock: [],
      out_of_stock: 0,
      invisible_products: [],
    },
    ...overrides,
  };
}

function render() {
  return renderWithProviders(<AdminDashboardPage />, {
    user: createMockAdminUser(),
    initialEntries: ['/admin'],
  });
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    // Block body, deliberately. `() => getStats.mockReset()` returns the mock,
    // and vitest treats a function returned from a hook as a teardown callback -
    // so it called getStats() after the test, which with a rejecting
    // implementation still installed produced an unhandled rejection and failed
    // the test that had already passed.
    getStats.mockReset();
  });

  it('leads with what is waiting, and how long it has waited', async () => {
    // The age is the point. Three to confirm is a normal morning; one that has
    // sat two days is a customer wondering whether the shop is real.
    getStats.mockResolvedValue(
      stats({ queue: { to_confirm: 3, to_ship: 1, in_transit: 2, oldest_awaiting_hours: 50 } }),
    );
    render();

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('To confirm')).toBeInTheDocument();
    expect(screen.getByText(/oldest 2d/)).toBeInTheDocument();
  });

  it('sends you to the orders that need the action', async () => {
    getStats.mockResolvedValue(
      stats({ queue: { to_confirm: 2, to_ship: 4, in_transit: 0, oldest_awaiting_hours: 2 } }),
    );
    render();

    const toShip = await screen.findByRole('link', { name: /to ship/i });
    expect(toShip).toHaveAttribute('href', '/admin/orders?status=confirmed');
  });

  it('says so plainly when nothing is waiting', async () => {
    getStats.mockResolvedValue(stats());
    render();

    expect(await screen.findByText(/nothing waiting/i)).toBeInTheDocument();
  });

  it('lists what is running out, linked to the product to reorder', async () => {
    getStats.mockResolvedValue(
      stats({
        catalogue: {
          ...stats().catalogue,
          low_stock_total: 1,
          low_stock: [
            {
              variant_id: 'v1',
              catalog_id: 'AB-101-50',
              stock: 2,
              variant_label: '50 ug',
              product_id: 'p1',
              product_name: 'Anti-Tau',
            },
          ],
        },
      }),
    );
    render();

    expect(await screen.findByText('Anti-Tau')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /anti-tau/i })).toHaveAttribute(
      'href',
      '/admin/products/p1',
    );
  });

  it('distinguishes out of stock from merely low', async () => {
    getStats.mockResolvedValue(
      stats({
        catalogue: {
          ...stats().catalogue,
          low_stock_total: 1,
          out_of_stock: 1,
          low_stock: [
            {
              variant_id: 'v1',
              catalog_id: 'AB-101-50',
              stock: 0,
              variant_label: '50 ug',
              product_id: 'p1',
              product_name: 'Anti-Tau',
            },
          ],
        },
      }),
    );
    render();

    expect(await screen.findByText('out of stock')).toBeInTheDocument();
    expect(screen.queryByText('0 left')).not.toBeInTheDocument();
  });

  it('uses the threshold the server reports rather than its own', async () => {
    // The storefront already has LOW_STOCK_THRESHOLD; a second copy here would
    // let the admin and the shop disagree about what "low" means.
    getStats.mockResolvedValue(
      stats({ catalogue: { ...stats().catalogue, low_stock_threshold: 9 } }),
    );
    render();

    expect(await screen.findByText(/at or below 9/i)).toBeInTheDocument();
  });

  it('surfaces products customers cannot see', async () => {
    getStats.mockResolvedValue(
      stats({
        catalogue: {
          ...stats().catalogue,
          invisible_products: [{ id: 'p9', cat_id: 'GHOST-1', name: 'Unbuyable' }],
        },
      }),
    );
    render();

    expect(await screen.findByText('Unbuyable')).toBeInTheDocument();
    expect(screen.getByText('no variants')).toBeInTheDocument();
  });

  it('hides the invisible-products panel when there are none', async () => {
    getStats.mockResolvedValue(stats());
    render();

    await screen.findByText(/nothing waiting/i);
    expect(screen.queryByText(/not visible in the shop/i)).not.toBeInTheDocument();
  });

  it('names the timezone the dates are in', async () => {
    getStats.mockResolvedValue(stats());
    render();

    expect(await screen.findByText(/America\/New_York/)).toBeInTheDocument();
  });

  it('says it could not load rather than showing zeroes', async () => {
    // Every figure reading 0 is indistinguishable from a quiet week, and would
    // have the admin believe there is no work waiting.
    getStats.mockRejectedValue(new Error('Network is down'));
    render();

    expect(await screen.findByText(/network is down/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing waiting/i)).not.toBeInTheDocument();
  });
});
