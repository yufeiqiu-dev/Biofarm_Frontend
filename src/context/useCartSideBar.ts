import { createContext, useContext } from "react";
import type { AddToCartItem, CartItem } from "../types/cart_types";

export type CartSideBarContextValue = {
  isOpen: boolean;
  cartItems: CartItem[];
  addToCart: (item: AddToCartItem) => void;
  removeFromCart: (itemId: string) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  clearCart: () => void;
  /**
   * Catalogue numbers the customer cannot currently have in full.
   *
   * Reported rather than trimmed: quietly shrinking a basket on a page load is
   * how someone buys fewer than they meant and only finds out from the receipt.
   */
  unavailable: string[];
  /**
   * Re-pull the server's basket and merge it into this device's local copy.
   *
   * Local-first means there is no "loading" or "failed" state to gate a page
   * on - the basket above is already the truth as far as this device knows,
   * synchronously, from the moment the provider mounts. This exists for the
   * cart page's own pull point: opening it re-reconciles rather than trusting
   * whatever this device happened to have on mount. A no-op for a guest.
   */
  refreshCart: () => Promise<void>;
  toggleCartSideBar: () => void;
  openCartSideBar: () => void;
  closeCartSideBar: () => void;
};

// Split from the provider so that file exports only components - see the note
// in auth/useAuth.ts for why that matters to Fast Refresh.
export const CartSideBarContext = createContext<CartSideBarContextValue | undefined>(
  undefined
);

export function useCartSideBar() {
  const context = useContext(CartSideBarContext);

  if (!context) {
    throw new Error("useCartSideBar must be used within a CartSideBarProvider");
  }

  return context;
}
