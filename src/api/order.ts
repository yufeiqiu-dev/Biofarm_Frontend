import { apiRequest } from "./client";
import type {
  CheckoutCartItem,
  CheckoutShipping,
  Order,
  PaymentIntentResponse,
} from "../types/order_types";

export function createPaymentIntent(
  cart: CheckoutCartItem[],
  shipping: CheckoutShipping
): Promise<PaymentIntentResponse> {
  return apiRequest("/orders/payment-intent", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ cart, shipping }),
  });
}

export function getMyOrders(): Promise<Order[]> {
  return apiRequest("/orders", { auth: true });
}

export function getMyOrder(orderId: string): Promise<Order> {
  return apiRequest(`/orders/${orderId}`, { auth: true });
}

export function cancelMyOrder(orderId: string): Promise<Order> {
  return apiRequest(`/orders/${orderId}/cancel`, { method: "POST", auth: true });
}
