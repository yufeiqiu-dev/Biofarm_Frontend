import { apiRequest } from "./client";
import type { AdminOrder } from "../types/order_types";

export function adminListOrders(status?: string): Promise<AdminOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/admin/orders${query}`, { auth: true });
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

export function adminShipOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status: "shipped" }),
  });
}

export function adminDeliverOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status: "delivered" }),
  });
}

export function adminCancelOrder(orderId: string): Promise<AdminOrder> {
  return apiRequest(`/admin/orders/${orderId}/cancel`, {
    method: "POST",
    auth: true,
  });
}
