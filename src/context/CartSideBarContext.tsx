import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import type { AddToCartItem, CartItem } from "../types/cart_types";

type CartSideBarContextValue = {
  isOpen: boolean;
  cartItems: CartItem[];
  addToCart: (item: AddToCartItem) => void;
  removeFromCart: (itemId: string) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  toggleCartSideBar: () => void;
  openCartSideBar: () => void;
  closeCartSideBar: () => void;
};

const CartSideBarContext = createContext<CartSideBarContextValue | undefined>(
  undefined
);

function getCartStorageKey(userId: string) {
  return `cart:${userId}`;
}

export function CartSideBarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!user) {
      setCartItems([]);
      return;
    }

    const storageKey = getCartStorageKey(user.user_id);
    const savedCart = localStorage.getItem(storageKey);

    if (!savedCart) {
      setCartItems([]);
      return;
    }

    try {
      const parsedCart = JSON.parse(savedCart) as CartItem[];
      setCartItems(Array.isArray(parsedCart) ? parsedCart : []);
    } catch {
      setCartItems([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const storageKey = getCartStorageKey(user.user_id);
    localStorage.setItem(storageKey, JSON.stringify(cartItems));
  }, [user, cartItems]);

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
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const increaseQuantity = (itemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (itemId: string) => {
    setCartItems((prev) => {
      const targetItem = prev.find((item) => item.id === itemId);

      if (!targetItem) return prev;

      if (targetItem.quantity === 1) {
        return prev.filter((item) => item.id !== itemId);
      }

      return prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  return (
    <CartSideBarContext.Provider
      value={{
        isOpen,
        cartItems,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        toggleCartSideBar,
        openCartSideBar,
        closeCartSideBar,
      }}
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