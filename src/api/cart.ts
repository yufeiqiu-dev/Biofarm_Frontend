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
  /** The moment the server accepted this line's last change. */
  client_updated_at: string;
}

/**
 * A line removed on some device, handed back so a pulling device can fold the
 * deletion into its own merge rather than resurrecting a copy it still holds
 * live. No price or name - a tombstone is compared by its clock, never shown.
 */
export interface CartTombstoneResponse {
  variant_id: string;
  client_updated_at: string;
}

export interface CartResponse {
  items: CartLineResponse[];
  subtotal: number;
  /** Catalogue numbers the customer cannot currently have in full. */
  unavailable: string[];
  /**
   * Lines removed on some device, within the window a very-late sync could
   * still legitimately carry a pre-deletion copy of. The browser merges these
   * by `client_updated_at` exactly as it merges live lines - see
   * CartSideBarContext.computeReconciled.
   *
   * Optional because the two repos deploy independently: a frontend that ships
   * ahead of this field being served must degrade to "no tombstone info", not
   * throw. Absent it, a deletion made on another device is not learned about
   * until that device (or this one) pushes again.
   */
  deleted_lines?: CartTombstoneResponse[];
}

/**
 * One line offered up for reconciliation - not asserted, since the server may
 * hold something newer for this variant. `client_updated_at` is this device's
 * own clock at the moment of the edit, not now.
 */
export interface CartSyncLine {
  variant_id: string;
  quantity: number;
  client_updated_at: string;
  deleted: boolean;
}

/**
 * Read the basket as the server holds it.
 *
 * Called only at the handful of pull points (sign-in, opening the cart page) -
 * the browser is local-first, so this is not the render path.
 */
export function getCart(): Promise<CartResponse> {
  return apiRequest("/cart", { auth: true });
}

/**
 * Push a device's whole local basket for reconciliation, merged per line on the
 * server rather than replaced outright. This is the write path the browser
 * actually uses - see CartSideBarContext and
 * Biofarm_KnowledgeBase/documentation/designs/2026-09-08-local-first-cart-sync.md.
 *
 * `keepalive` is passed straight through to `fetch` - set it for a push fired
 * from a `pagehide` handler, so the request can outlive the document if the
 * browser tears the page down before it would otherwise finish.
 */
export function syncCart(
  items: CartSyncLine[],
  opts: { keepalive?: boolean } = {},
): Promise<CartResponse> {
  return apiRequest("/cart", {
    method: "PUT",
    auth: true,
    body: JSON.stringify({ items }),
    ...opts,
  });
}
