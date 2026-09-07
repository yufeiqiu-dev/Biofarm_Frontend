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
    queue: { to_confirm: 0, to_ship: 0, in_transit: 0, oldest_awaiting_hours: null, queue_value: 0 },
    volume: { today: 0, last_7_days: 0, last_30_days: 0, all_time: 0 },
    top_products: [],
    daily: [],
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
      stats({ queue: { to_confirm: 3, to_ship: 1, in_transit: 2, oldest_awaiting_hours: 50, queue_value: 0 } }),
    );
    render();

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('To confirm')).toBeInTheDocument();
    expect(screen.getByText(/oldest 2d/)).toBeInTheDocument();
  });

  it('sends you to the orders that need the action', async () => {
    getStats.mockResolvedValue(
      stats({ queue: { to_confirm: 2, to_ship: 4, in_transit: 0, oldest_awaiting_hours: 2, queue_value: 0 } }),
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

/*
 * The chart, and the one money figure.
 *
 * Stripe is authoritative for money - anything computed from our orders table
 * drifts from it on fees, refunds and disputes. The single figure here is the
 * queue priced, which Stripe cannot produce because it knows PaymentIntents and
 * not fulfilment state.
 */
describe('AdminDashboardPage chart and queue value', () => {
  beforeEach(() => {
    getStats.mockReset();
  });

  function days(counts: number[]) {
    let running = 0;
    return counts.map((orders, i) => {
      running += orders;
      return { date: `2026-09-${String(i + 1).padStart(2, '0')}`, orders, cumulative: running };
    });
  }

  it('draws a bar per day and a line for the running total', async () => {
    getStats.mockResolvedValue(stats({ daily: days([0, 2, 0, 1]) }));
    render();

    const chart = await screen.findByRole('img', { name: /orders per day/i });
    expect(chart.querySelectorAll('rect')).toHaveLength(4);
    expect(chart.querySelector('polyline')).toBeInTheDocument();
  });

  it('describes itself for a screen reader', async () => {
    // Without this the chart is decorative and the growth is unreadable.
    getStats.mockResolvedValue(stats({ daily: days([1, 2]) }));
    render();

    expect(
      await screen.findByRole('img', { name: /3 in the period, 3 in total/i }),
    ).toBeInTheDocument();
  });

  it('leaves empty days empty rather than drawing a sliver', async () => {
    getStats.mockResolvedValue(stats({ daily: days([0, 0, 4]) }));
    render();

    const chart = await screen.findByRole('img', { name: /orders per day/i });
    const heights = [...chart.querySelectorAll('rect')].map((r) =>
      Number(r.getAttribute('height')),
    );
    expect(heights.filter((h) => h === 0)).toHaveLength(2);
  });

  it('draws nothing at all with no series', async () => {
    getStats.mockResolvedValue(stats({ daily: [] }));
    render();

    await screen.findByText(/nothing waiting/i);
    expect(screen.queryByRole('img', { name: /orders per day/i })).not.toBeInTheDocument();
  });

  it('prices the queue so an afternoon is distinguishable from ten minutes', async () => {
    getStats.mockResolvedValue(
      stats({
        queue: { to_confirm: 3, to_ship: 1, in_transit: 0, oldest_awaiting_hours: 5, queue_value: 1840 },
      }),
    );
    render();

    expect(await screen.findByText(/\$1,840 of goods awaiting shipment/i)).toBeInTheDocument();
  });

  it('points at Stripe for anything that is actually money', async () => {
    getStats.mockResolvedValue(
      stats({
        queue: { to_confirm: 1, to_ship: 0, in_transit: 0, oldest_awaiting_hours: 1, queue_value: 50 },
      }),
    );
    render();

    const link = await screen.findByRole('link', { name: /payments are in stripe/i });
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/payments');
  });

  it('says nothing about money when nothing is waiting', async () => {
    getStats.mockResolvedValue(stats());
    render();

    await screen.findByText(/nothing waiting/i);
    expect(screen.queryByText(/awaiting shipment/i)).not.toBeInTheDocument();
  });
});

describe('OrderChart axis labels', () => {
  beforeEach(() => {
    getStats.mockReset();
  });

  it('labels dates month-first', async () => {
    // It rendered `${day}/${month}`, so 6 September read as "6/9" - the 9th of
    // June to anyone reading a dollar-priced shop keyed to America/New_York.
    getStats.mockResolvedValue(
      stats({
        daily: [
          { date: '2026-08-09', orders: 0, cumulative: 0 },
          { date: '2026-09-06', orders: 2, cumulative: 2 },
        ],
      }),
    );
    render();

    const chart = await screen.findByRole('img', { name: /orders per day/i });
    const labels = [...chart.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('8/9');
    expect(labels).toContain('9/6');
  });
});

/*
 * Regressions the review found: a tile whose destination contradicts it, a
 * growth line that flattens as the shop grows, and a version-skewed deploy
 * blanking the console.
 */
describe('AdminDashboardPage review fixes', () => {
  beforeEach(() => {
    getStats.mockReset();
  });

  it('volume tiles land on the unfiltered list', async () => {
    // A bare /admin/orders now means "no status parameter", which the order
    // list reads as its default tab - so "All time: 412" showed only the orders
    // awaiting confirmation.
    getStats.mockResolvedValue(stats({ volume: { today: 1, last_7_days: 4, last_30_days: 9, all_time: 412 } }));
    render();

    const allTime = await screen.findByRole('link', { name: /all time/i });
    expect(allTime).toHaveAttribute('href', '/admin/orders?status=all');
  });

  it('the growth line uses the frame even when the shop has history', async () => {
    // Zero-based, a shop with 500 lifetime orders and 30 this month draws the
    // line across 5.7% of the plot - a flat line pinned to the top edge, which
    // is exactly the growth it exists to show.
    const daily = Array.from({ length: 4 }, (_, i) => ({
      date: `2026-09-0${i + 1}`,
      orders: 10,
      cumulative: 500 + (i + 1) * 10,
    }));
    getStats.mockResolvedValue(stats({ daily }));
    render();

    const chart = await screen.findByRole('img', { name: /orders per day/i });
    const ys = chart
      .querySelector('polyline')!
      .getAttribute('points')!
      .split(' ')
      .map((p) => Number(p.split(',')[1]));

    // Top to bottom of the plot, not a sliver.
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(100);
  });

  it('labels the floor of the running total, not only its peak', async () => {
    const daily = [
      { date: '2026-09-01', orders: 1, cumulative: 500 },
      { date: '2026-09-02', orders: 1, cumulative: 501 },
    ];
    getStats.mockResolvedValue(stats({ daily }));
    render();

    const chart = await screen.findByRole('img', { name: /orders per day/i });
    const labels = [...chart.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('500');
    expect(labels).toContain('501');
  });

  it('survives a response with no series at all', async () => {
    // A frontend deployed ahead of its backend gets a successful /admin/stats
    // with no `daily`. There is no ErrorBoundary, so a throw here blanks the
    // entire admin console.
    getStats.mockResolvedValue({ ...stats(), daily: undefined } as never);
    render();

    expect(await screen.findByText(/nothing waiting/i)).toBeInTheDocument();
  });
});
