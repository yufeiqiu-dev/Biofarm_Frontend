import {
    createContext,
    useContext,
    useState,
    type ReactNode,
  } from "react";
import type { CartItem } from "../types/cart_types";
import type { AddToCartItem } from "../types/cart_types";
type CartSideBarContextValue = {
    isOpen: boolean;
    toggleCartSideBar: () => void;
    openCartSideBar: () => void;
    closeCartSideBar: () => void;
    cartItems: CartItem[];
    addToCart: (item: AddToCartItem) => void;
    removeFromCart: (itemId: string) => void;
    increaseQuantity: (itemId: string) => void;
    decreaseQuantity: (itemId: string) => void;
    clearCart: () => void;
  };
  
  const CartSideBarContext = createContext<CartSideBarContextValue | undefined>(
    undefined
  );
  
  export function CartSideBarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    const toggleCartSideBar = () => setIsOpen((prev) => !prev);
    const openCartSideBar = () => setIsOpen(true);
    const closeCartSideBar = () => setIsOpen(false);

    const addToCart = (item: AddToCartItem) => {
      setCartItems((prev) => {
        const existingItem = prev.find(
          (cartItem) => cartItem.variantId === item.variantId
        );
  
        if (existingItem) {
          return prev.map((cartItem) =>
            cartItem.variantId === item.variantId
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          );
        }
  
        const newCartItem: CartItem = {
          ...item,
          id: `${item.productId}-${item.variantId}`,
          quantity: 1,
        };
  
        return [...prev, newCartItem];
      });
    };

    const removeFromCart = (itemId: string) => {
      // TODO: Implement remove from cart logic
    };

    const increaseQuantity = (itemId: string) => {
      // TODO: Implement increase quantity logic
    };
    
    const decreaseQuantity = (itemId: string) => {
      // TODO: Implement decrease quantity logic
    };

    const clearCart = () => {
      // TODO: Implement clear cart logic
      setCartItems([]);
    };

    return (
      <CartSideBarContext.Provider
        value={{ isOpen, toggleCartSideBar, openCartSideBar, closeCartSideBar, 
          cartItems, addToCart, removeFromCart, increaseQuantity, decreaseQuantity, clearCart }}
      >
        {children}
      </CartSideBarContext.Provider>
    );
  }
  
  export function useCartSideBar() {
    const context = useContext(CartSideBarContext);
  
    if (!context) {
      throw new Error("useCartSideBar must be used within a CartSideBarProvider");
    }
  
    return context;
  }