import { apiRequest } from "./client";
import type { AdminOrder } from "../types/order_types";

/** One page of the admin order list, plus how many match in total. */
export interface AdminOrderPage {
  items: AdminOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminOrderQuery {
  status?: string;
  /** Matches order number, customer email, shipping name, user id or order id. */
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Orders are the one list that grows without bound, so this is paged and
 * searched on the server.
 *
 * Searching here rather than in the browser is not a preference: a client-side
 * filter over a *page* silently searches that page and reports nothing for
 * every other order, which looks identical to "no results".
 */
export function adminListOrders(query: AdminOrderQuery = {}): Promise<AdminOrderPage> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));

  const suffix = params.toString() ? `?${params}` : "";
  return apiRequest(`/admin/orders${suffix}`, { auth: true });
}

export function adminGetOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}`, { auth: true });
}

export function adminConfirmOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status: "confirmed" }),
  });
}

export function adminShipOrder(orderId: string, trackingNumber?: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status: "shipped", tracking_number: trackingNumber || undefined }),
  });
}

export function adminDeliverOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status: "delivered" }),
  });
}

export function adminUpdateTracking(orderId: string, trackingNumber: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/tracking`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ tracking_number: trackingNumber }),
  });
}

export function adminCancelOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/cancel`, {
    method: "POST",
    auth: true,
  });
}
