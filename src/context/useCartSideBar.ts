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
