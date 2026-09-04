import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/useAuth";
import type { AddToCartItem, CartItem } from "../types/cart_types";
import { CartSideBarContext } from "./useCartSideBar";

// A module-level constant, so the transient "identity just changed" render
// does not hand the context memo a brand-new array on every pass.
const NO_ITEMS: CartItem[] = [];

function getCartStorageKey(userId: string) {
  return `cart:${userId}`;
}

/** Read a user's saved cart, tolerating anything localStorage might hold. */
function loadCart(userId: string): CartItem[] {
  try {
    const saved = localStorage.getItem(getCartStorageKey(userId));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON, or a browser that denies storage access entirely (private
    // mode, blocked site data). An empty cart is the right answer to both.
    return [];
  }
}

export function CartSideBarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;

  const [isOpen, setIsOpen] = useState(false);

  // Deriving the initial cart in the state initializer rather than assigning it
  // from an effect. The effect version set three pieces of state on every
  // change of `user`, so the first paint after a sign-in rendered an empty cart
  // and then immediately replaced it - a visible flash of "your cart is empty",
  // and the cascading render the linter was pointing at.
  const [state, setState] = useState<{ userId: string | null; items: CartItem[] }>(() => ({
    userId,
    items: userId ? loadCart(userId) : [],
  }));

  // Reloading on identity change is genuinely reactive to an external system,
  // so it stays in render rather than an effect: React re-runs this component
  // with the new state immediately, before anything reaches the DOM. Signing
  // out empties the in-memory cart; the signed-out user has no saved one.
  if (state.userId !== userId) {
    setState({ userId, items: userId ? loadCart(userId) : [] });
  }

  const { userId: loadedUserId, items } = state;
  const cartItems = loadedUserId === userId ? items : NO_ITEMS;

  useEffect(() => {
    if (!userId || loadedUserId !== userId) return;
    try {
      localStorage.setItem(getCartStorageKey(userId), JSON.stringify(items));
    } catch {
      // Storage full, or denied outright by a browser blocking site data. The
      // cart still works for this session; it just will not survive a reload.
    }
  }, [userId, loadedUserId, items]);

  const setItems = useCallback(
    (update: (prev: CartItem[]) => CartItem[]) =>
      setState((prev) => ({ ...prev, items: update(prev.items) })),
    []
  );

  const toggleCartSideBar = useCallback(() => setIsOpen((prev) => !prev), []);
  const openCartSideBar = useCallback(() => setIsOpen(true), []);
  const closeCartSideBar = useCallback(() => setIsOpen(false), []);

  const addToCart = useCallback(
    (item: AddToCartItem) =>
      setItems((prev) => {
        // Deduped by variantId, not productId: two sizes of the same product
        // are two distinct lines.
        const existing = prev.find((cartItem) => cartItem.variantId === item.variantId);

        if (existing) {
          return prev.map((cartItem) =>
            cartItem.variantId === item.variantId
              ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
              : cartItem
          );
        }

        return [...prev, { ...item, id: `${item.productId}-${item.variantId}`, quantity: item.quantity }];
      }),
    [setItems]
  );

  const removeFromCart = useCallback(
    (itemId: string) => setItems((prev) => prev.filter((item) => item.id !== itemId)),
    [setItems]
  );

  const increaseQuantity = useCallback(
    (itemId: string) =>
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
        )
      ),
    [setItems]
  );

  const decreaseQuantity = useCallback(
    (itemId: string) =>
      setItems((prev) => {
        const target = prev.find((item) => item.id === itemId);
        if (!target) return prev;
        if (target.quantity === 1) return prev.filter((item) => item.id !== itemId);
        return prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }),
    [setItems]
  );

  // Called by OrderSuccessPage once an order exists. Clears the saved copy too,
  // rather than leaving that to the persistence effect - the previous version
  // deferred it behind a ref that was only consulted on the next change of
  // user, so a reload before then brought the paid-for cart back.
  const clearCart = useCallback(() => {
    setItems(() => []);
    if (userId) {
      try {
        localStorage.removeItem(getCartStorageKey(userId));
      } catch {
        // Nothing to do; the in-memory cart is emptied either way.
      }
    }
  }, [setItems, userId]);

  // Memoized, and every handler with it. Previously this object was rebuilt
  // inline on each render, so every consumer of the cart re-rendered whenever
  // anything in the provider changed - including the sidebar open/closed flag,
  // which nothing outside the sidebar cares about.
  const value = useMemo(
    () => ({
      isOpen,
      cartItems,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      toggleCartSideBar,
      openCartSideBar,
      closeCartSideBar,
    }),
    [
      isOpen,
      cartItems,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      toggleCartSideBar,
      openCartSideBar,
      closeCartSideBar,
    ]
  );

  return (
    <CartSideBarContext.Provider value={value}>{children}</CartSideBarContext.Provider>
  );
}
