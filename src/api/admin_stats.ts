import { apiRequest } from "./client";

export interface AdminQueue {
  to_confirm: number;
  to_ship: number;
  in_transit: number;
  /** null when nothing is waiting. */
  oldest_awaiting_hours: number | null;
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

export interface AdminStats {
  timezone: string;
  generated_at: string;
  queue: AdminQueue;
  volume: AdminVolume;
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
