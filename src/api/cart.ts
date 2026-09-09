import { apiRequest } from "./client";

/**
 * The basket, as the server holds it.
 *
 * Everything but the quantity is read from the catalogue when the basket is
 * fetched, so a repricing or a rename shows up rather than the customer seeing
 * what a product cost when they added it.
 */
export interface CartLineResponse {
  variant_id: string;
  product_id: string;
  name: string;
  catalog_number: string;
  size_label: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  /** What the shelf holds now. */
  available: number;
  /** True when the basket asks for more than `available`. */
  over_stock: boolean;
}

export interface CartResponse {
  items: CartLineResponse[];
  subtotal: number;
  /** Catalogue numbers the customer cannot currently have in full. */
  unavailable: string[];
}

export function getCart(): Promise<CartResponse> {
  return apiRequest("/cart", { auth: true });
}

/**
 * Set one line to an absolute quantity.
 *
 * Per line, and absolute. A whole-basket PUT would be a read-modify-write over
 * something two open tabs can both edit - the shape that let the product form
 * overwrite stock sold while it was open. Every call returns the whole basket,
 * so the client never has to guess what the server now holds.
 */
export function setCartLine(variantId: string, quantity: number): Promise<CartResponse> {
  return apiRequest(`/cart/items/${variantId}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartLine(variantId: string): Promise<CartResponse> {
  return apiRequest(`/cart/items/${variantId}`, { method: "DELETE", auth: true });
}

export function clearServerCart(): Promise<void> {
  return apiRequest("/cart", { method: "DELETE", auth: true });
}
