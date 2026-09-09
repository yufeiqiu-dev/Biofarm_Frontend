export type OrderStatus =
  | "pending"
  | "awaiting_fulfillment"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  quantity: number;
}

export interface AdminOrderItem extends OrderItem {
  current_stock: number | null;
}

export interface Order {
  id: string;
  /** Ten digits, customer-facing and deliberately not sequential, e.g.
   *  "4827193056". A string rather than a number: nothing does arithmetic on it,
   *  and JSON numbers would invite exactly that. Not an ordering key - sort by
   *  created_at. */
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  tax_amount: number;
  /** What the customer paid to have it sent. Zero on orders placed before
   *  shipping was charged, so an old order still adds up to what was taken. */
  shipping_amount: number;
  card_brand: string;
  card_last4: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  notes: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface AdminOrder extends Order {
  user_id: string;
  /**
   * Days until Stripe's hold on the card lapses; null once the money has moved
   * or been released. Negative means it already has.
   *
   * Checkout only authorises - the money is captured when the order is
   * *confirmed* - and a hold Stripe has released cannot be captured, so this is
   * a deadline, not a statistic.
   *
   * Optional, deliberately. The two repos deploy independently, so a frontend
   * shipped ahead of its backend receives this field absent rather than null.
   * Declaring it required told the next caller it was always there, and
   * `.toFixed()` on it would have typechecked and thrown in exactly the case
   * the runtime guard exists for.
   */
  authorization_days_remaining?: number | null;

  /**
   * When the card was actually charged, or null if it has not been.
   *
   * The console branches on this rather than on status. Deriving it from status
   * is what left the cancel dialog telling an admin "no charge has been made"
   * about an order that had been charged - status meant opposite things either
   * side of the capture moving to confirm.
   */
  captured_at?: string | null;

  customer_email: string;
  stripe_payment_intent_id: string;
  items: AdminOrderItem[];
}

export interface PaymentIntentResponse {
  client_secret: string;
  order_id?: string;
  subtotal_cents: number;
  tax_amount_cents: number;
  shipping_amount_cents: number;
}

export interface CheckoutShipping {
  name: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
}

export interface CheckoutCartItem {
  variant_id: string;
  quantity: number;
}
