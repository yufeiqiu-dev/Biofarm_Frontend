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
  order_number: number;
  status: OrderStatus;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface AdminOrder extends Order {
  user_id: string;
  stripe_payment_intent_id: string;
  items: AdminOrderItem[];
}

export interface PaymentIntentResponse {
  client_secret: string;
  order_id?: string; // only set in bypass mode; real flow creates order on webhook
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
