import { apiRequest } from "./client";

export interface AdminQueue {
  to_confirm: number;
  to_ship: number;
  in_transit: number;
  /** null when nothing is waiting. */
  oldest_awaiting_hours: number | null;
  /**
   * Unshipped orders whose card hold lapses within the warning window, and
   * those whose hold has already lapsed.
   *
   * Optional for the reason the order field is: the repos deploy independently,
   * so a frontend ahead of its backend receives these absent. Declared required,
   * `undefined === 0` is false forever - and the dashboard rendered three zero
   * tiles instead of saying nothing was waiting.
   */
  authorization_expiring?: number;
  authorization_expired?: number;
  /**
   * Everything unshipped, priced pre-tax - awaiting_fulfillment and confirmed
   * together, which is why it is named for the queue rather than for
   * "awaiting": the two fields above mean awaiting_fulfillment alone.
   *
   * Not revenue and not a payout figure. Stripe is authoritative for money;
   * this exists so an admin can tell an afternoon's work from ten minutes'.
   */
  queue_value: number;
}

export interface AdminVolume {
  today: number;
  last_7_days: number;
  last_30_days: number;
  all_time: number;
}

export interface AdminTopProduct {
  product_name: string;
  units: number;
}

export interface AdminLowStock {
  variant_id: string;
  catalog_id: string;
  stock: number;
  variant_label: string;
  product_id: string;
  product_name: string;
}

export interface AdminInvisibleProduct {
  id: string;
  cat_id: string;
  name: string;
}

export interface AdminCatalogue {
  products: number;
  variants: number;
  /** The server's definition of "low", so the page does not keep its own. */
  low_stock_threshold: number;
  low_stock_total: number;
  low_stock: AdminLowStock[];
  out_of_stock: number;
  invisible_products: AdminInvisibleProduct[];
}

export interface AdminDailyPoint {
  date: string;
  orders: number;
  /** Counted from the shop's first order, not the window's start. */
  cumulative: number;
}

export interface AdminStats {
  timezone: string;
  generated_at: string;
  queue: AdminQueue;
  volume: AdminVolume;
  daily: AdminDailyPoint[];
  top_products: AdminTopProduct[];
  catalogue: AdminCatalogue;
}

/**
 * Everything the dashboard shows, in one request.
 *
 * Aggregated server-side rather than by pulling the orders down and counting
 * them here - which is what the admin order list was moved off, and this is the
 * page most likely to be left open all day.
 */
export function getAdminStats(): Promise<AdminStats> {
  return apiRequest("/admin/stats", { auth: true });
}
