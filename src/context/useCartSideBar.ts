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
  /** True while the saved basket is being fetched for the first time. */
  loading: boolean;
  /**
   * True when the basket could not be read at all.
   *
   * Distinct from an empty basket, and the distinction matters: telling a
   * customer their cart is empty when it is merely unknown sends them off to
   * browse for things they have already chosen.
   */
  failed: boolean;
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
