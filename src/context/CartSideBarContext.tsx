import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../api/client";
import { useReminder } from "./useReminder";
import {
  clearServerCart,
  getCart,
  removeCartLine,
  setCartLine,
  type CartResponse,
} from "../api/cart";
import type { AddToCartItem, CartItem } from "../types/cart_types";
import { CartSideBarContext } from "./useCartSideBar";

/*
 * The basket lives on the server.
 *
 * It used to live in localStorage under `cart:{sub}`, which ties a basket to a
 * device and not to a person: fill one on a phone, sign in on a laptop, and it
 * is gone. Nothing is cached locally now - a second copy is a second source of
 * truth, and reconciling the two is the divergence this move exists to remove.
 *
 * Writes are optimistic and roll back. A basket is a direct-manipulation UI:
 * waiting for a round trip before the quantity moves makes every press feel
 * broken, and silently keeping a change the server refused would be worse than
 * either.
 */

// A module-level constant, so the transient "identity just changed" render does
// not hand the context memo a brand-new array on every pass.
const NO_ITEMS: CartItem[] = [];
const NO_UNAVAILABLE: string[] = [];

/** The line id the sidebar and cart page address items by. */
function lineId(productId: string, variantId: string) {
  return `${productId}-${variantId}`;
}

/**
 * Hand a basket saved by the old localStorage cart to the server, once.
 *
 * Without this, every customer holding an unbought basket at deploy loses it -
 * which is a poor way to introduce a feature whose entire promise is that
 * baskets stop disappearing.
 *
 * Runs after the server basket has been read, and keeps the larger quantity per
 * line so a re-run cannot double anything. The key is dropped whatever happens:
 * a basket that cannot be replayed twice is better than one that is retried on
 * every page load forever.
 */
async function migrateLocalCart(userId: string, server: CartResponse): Promise<boolean> {
  const key = `cart:${userId}`;
  let saved: { variantId?: string; quantity?: number }[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    saved = Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON, or storage denied outright. Nothing to migrate either way.
    return false;
  }

  let handed = 0;
  const retry: typeof saved = [];

  for (const line of saved) {
    if (!line?.variantId || !line.quantity) continue;
    const onServer = server.items.find((item) => item.variant_id === line.variantId);
    const quantity = Math.max(line.quantity, onServer?.quantity ?? 0);
    try {
      await setCartLine(line.variantId, quantity);
      handed += 1;
    } catch (error) {
      /*
       * Per line, and only a line that might succeed later is kept.
       *
       * A refusal the server will repeat - a variant discontinued since, a
       * stored quantity it will never accept - is dropped, because retrying it
       * forever would keep the whole key alive. That matters more than it
       * sounds: this replays Math.max(local, server), so a key that never goes
       * away resurrects quantities the customer has since changed. Delete an
       * item, reload, and it is back.
       */
      const permanent = error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (!permanent) retry.push(line);
    }
  }

  try {
    if (retry.length > 0) {
      // Only what is worth trying again, never the lines already handed over.
      localStorage.setItem(key, JSON.stringify(retry));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage denied. At worst the handover is attempted again, which is safe:
    // it keeps the larger quantity rather than adding to it.
  }
  return handed > 0;
}

function toCartItems(response: CartResponse): CartItem[] {
  return response.items.map((line) => ({
    id: lineId(line.product_id, line.variant_id),
    productId: line.product_id,
    variantId: line.variant_id,
    name: line.name,
    imageUrl: line.image_url,
    catalogNumber: line.catalog_number,
    sizeLabel: line.size_label,
    unitPrice: line.unit_price,
    quantity: line.quantity,
    available: line.available,
    overStock: line.over_stock,
  }));
}

export function CartSideBarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showReminder } = useReminder();
  const userId = user?.user_id ?? null;

  const [isOpen, setIsOpen] = useState(false);

  /*
   * The basket, carrying the identity it belongs to.
   *
   * One piece of state rather than three, and the signed-out case is derived
   * from it rather than assigned by an effect: an effect that writes state on
   * every change of user renders the previous customer's basket first and
   * replaces it a frame later, which is both a visible flash and a cascading
   * render.
   */
  const [state, setState] = useState<{
    owner: string | null;
    items: CartItem[];
    unavailable: string[];
    /**
     * Whether this basket is trustworthy.
     *
     * "failed" is not "empty", and conflating them was doing real damage: one
     * timeout on the load showed "your cart is empty" for the rest of the
     * session while the server held the basket - and because a write sends an
     * absolute quantity, the next Add computed 0 + 1 and overwrote the real
     * basket with a single line.
     */
    status: "ready" | "failed";
  }>({ owner: null, items: NO_ITEMS, unavailable: [], status: "ready" });

  const settled = state.owner === userId;
  const loaded = settled && state.status === "ready";
  const failed = settled && state.status === "failed";
  const cartItems = loaded ? state.items : NO_ITEMS;
  // NO_UNAVAILABLE rather than a fresh [], which would be a new identity every
  // render and defeat the memo below.
  const unavailable = loaded ? state.unavailable : NO_UNAVAILABLE;
  // Derived, so there is no flag to leave switched on down some path that
  // forgot to clear it. Signed out, there is nothing to wait for.
  const loading = userId !== null && !settled;

  const setCartItems = useCallback(
    (update: CartItem[] | ((previous: CartItem[]) => CartItem[])) =>
      setState((previous) => ({
        ...previous,
        items: typeof update === "function" ? update(previous.items) : update,
      })),
    [],
  );

  /*
   * The identity the current basket belongs to.
   *
   * Read by the write handlers before they apply a server response, so a reply
   * that arrives after a sign-out - or after a different account signs in -
   * cannot paint one customer's basket into another's session.
   */
  const ownerRef = useRef<string | null>(null);

  /*
   * Which write a response belongs to.
   *
   * Every reply carries the whole basket, so applying a stale one undoes newer
   * changes. Two quick presses of "+" send quantity 2 then 3; if the answers
   * come back out of order the screen settles on 2 while the server holds 3,
   * and nothing reconciles them until the next full load.
   */
  const writeSeq = useRef(0);

  /*
   * The basket as of the last change, including ones not yet rendered.
   *
   * The handlers used to compute from the render closure, so two presses of "+"
   * landing before React re-rendered both read the same quantity and both sent
   * it - and because the write is absolute rather than an increment, one press
   * was silently dropped instead of arriving twice. Updated in the handler
   * itself, which is an event and not a render.
   */
  const pendingItems = useRef<CartItem[] | null>(null);


  const applyResponse = useCallback(
    (response: CartResponse, owner: string | null) => {
      if (ownerRef.current !== owner) return;
      const items = toCartItems(response);
      // The server has spoken, so the local running total is finished with.
      pendingItems.current = items;
      setState({ owner, items, unavailable: response.unavailable, status: "ready" });
    },
    [],
  );

  useEffect(() => {
    ownerRef.current = userId;
    // Signed out, the derivation above already shows an empty basket. The
    // basket itself is not lost - it is on the server - it is just not this
    // browser's to show.
    if (!userId) return;

    let cancelled = false;
    getCart()
      .then(async (response) => {
        if (cancelled) return;
        // A basket left behind by the old localStorage cart is handed over
        // before the first paint, so the customer never sees it disappear.
        const migrated = await migrateLocalCart(userId, response);
        if (cancelled) return;
        applyResponse(migrated ? await getCart() : response, userId);
      })
      .catch(() => {
        // An empty basket is the honest answer when we could not read one, and
        // marking it loaded stops the sidebar waiting forever. Not surfaced as
        // a reminder: this happens on load, with no action of the customer's to
        // attach it to.
        if (!cancelled && ownerRef.current === userId) {
          // Settled but not ready: the basket is unknown, not empty. Writes are
          // refused below rather than computed against a view we know is wrong.
          setState({ owner: userId, items: NO_ITEMS, unavailable: [], status: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, applyResponse]);

  /**
   * Apply a change to the basket on screen, then to the server, rolling back if
   * the server refuses.
   *
   * The rollback is the point. Without it a failed write leaves the customer
   * looking at a basket that does not exist - and they find out at checkout,
   * which is the worst possible moment.
   */
  const mutate = useCallback(
    (
      optimistic: (previous: CartItem[]) => CartItem[],
      request: () => Promise<CartResponse | void>,
      /**
       * Whether this write is computed from what is on screen.
       *
       * Everything that sends a quantity is: acting on a basket we have not
       * read overwrites the real one. Emptying it is not - it says "remove
       * everything" regardless of what is there - and gating that too broke the
       * success page, which clears once, behind a ref, and never retries: the
       * customer saw "your cart is still loading" on the screen confirming
       * their payment, and the basket was never emptied.
       */
      needsCurrentBasket = true,
    ) => {
      /*
       * The identity from this render, not from the ref.
       *
       * The ref is set by the provider's effect, and effects run child-first -
       * so a child clearing the basket on mount (OrderSuccessPage, once an
       * order appears) reached here before the provider had ever set it, took
       * the early return, and never told the server. The paid-for basket came
       * straight back on the next load.
       */
      const owner = userId;
      if (!owner) return;

      /*
       * Only against a basket we have actually read.
       *
       * The write sends an absolute quantity, computed from what is on screen -
       * so acting on a view that is still loading, or that failed to load,
       * overwrites the real basket. Five in the basket, a click before the load
       * lands, and the server is told "1".
       */
      if (needsCurrentBasket && !loaded) {
        showReminder({
          message: failed
            ? "We could not load your cart. Please refresh the page."
            : "Your cart is still loading. Try again in a moment.",
        });
        return;
      }
      // Covers that same first-paint gap for the staleness check below.
      ownerRef.current ??= owner;

      /*
       * The basket as this render sees it, captured before the change.
       *
       * Not read from inside the state updater, which looks equivalent and is
       * not: React runs that updater when it next renders, which can be after a
       * rejected request has already reached the catch below - so the rollback
       * restored whatever the variable happened to be initialised to, and a
       * failed add emptied the basket instead of leaving it alone.
       */
      const current = pendingItems.current ?? cartItems;
      const rollback = current;
      const next = optimistic(current);
      pendingItems.current = next;

      const seq = ++writeSeq.current;
      setCartItems(next);

      void request()
        .then((response) => {
          // Only the newest write may repaint the basket; an older reply is a
          // snapshot from before the change now on screen.
          if (response && seq === writeSeq.current) applyResponse(response, owner);
        })
        .catch(() => {
          if (ownerRef.current !== owner) return;
          /*
           * Only if nothing newer has happened since.
           *
           * The success path already refuses to repaint from a stale reply; the
           * failure path did not, and rolling back to a snapshot taken before
           * this write undoes everything that came after it. Press "+", then
           * remove the line: the removal succeeds, the "+" then times out, and
           * the removed item reappears with nothing left to correct it.
           */
          if (seq !== writeSeq.current) return;
          pendingItems.current = rollback;
          setCartItems(rollback);
          showReminder({
            message: "We could not update your cart. Please try again.",
          });
        });
    },
    [applyResponse, cartItems, failed, loaded, setCartItems, showReminder, userId],
  );

  const toggleCartSideBar = useCallback(() => setIsOpen((prev) => !prev), []);
  const openCartSideBar = useCallback(() => setIsOpen(true), []);
  const closeCartSideBar = useCallback(() => setIsOpen(false), []);

  const addToCart = useCallback(
    (item: AddToCartItem) => {
      // Deduped by variantId, not productId: two sizes of the same product are
      // two distinct lines.
      const existing = (pendingItems.current ?? cartItems).find(
        (line) => line.variantId === item.variantId,
      );
      const quantity = (existing?.quantity ?? 0) + item.quantity;

      mutate(
        (previous) =>
          existing
            ? previous.map((line) =>
                line.variantId === item.variantId ? { ...line, quantity } : line,
              )
            : [
                ...previous,
                { ...item, id: lineId(item.productId, item.variantId), quantity },
              ],
        () => setCartLine(item.variantId, quantity),
      );
    },
    [cartItems, mutate],
  );

  const removeFromCart = useCallback(
    (itemId: string) => {
      const target = (pendingItems.current ?? cartItems).find((line) => line.id === itemId);
      if (!target) return;
      mutate(
        (previous) => previous.filter((line) => line.id !== itemId),
        () => removeCartLine(target.variantId),
      );
    },
    [cartItems, mutate],
  );

  const setQuantity = useCallback(
    (itemId: string, next: (current: number) => number) => {
      const target = (pendingItems.current ?? cartItems).find((line) => line.id === itemId);
      if (!target) return;
      const quantity = next(target.quantity);

      mutate(
        (previous) =>
          quantity <= 0
            ? previous.filter((line) => line.id !== itemId)
            : previous.map((line) => (line.id === itemId ? { ...line, quantity } : line)),
        () => setCartLine(target.variantId, quantity),
      );
    },
    [cartItems, mutate],
  );

  const increaseQuantity = useCallback(
    (itemId: string) => setQuantity(itemId, (current) => current + 1),
    [setQuantity],
  );

  const decreaseQuantity = useCallback(
    (itemId: string) => setQuantity(itemId, (current) => current - 1),
    [setQuantity],
  );

  /*
   * Called by OrderSuccessPage once an order exists.
   *
   * The server already empties the basket in the same commit as the order, so
   * this is about the copy on screen rather than the record. It still asks the
   * server, because in bypass mode the order is created inline and this is the
   * only signal that a purchase happened.
   */
  const clearCart = useCallback(() => {
    // The stock warning refers to lines that are about to be gone, so it goes
    // with them - otherwise the sidebar reads "… is no longer available" over
    // an empty basket until the next full load.
    setState((previous) => ({ ...previous, unavailable: NO_UNAVAILABLE }));
    mutate(
      () => NO_ITEMS,
      async () => {
        await clearServerCart();
        // Known to be empty now, so a session that started with a failed load
        // stops claiming the basket is unreadable - nothing would have retried,
        // because the success page clears once behind a ref.
        setState((previous) => ({ ...previous, status: "ready" }));
      },
      // Sends no computed quantity, so it does not need the basket read first.
      false,
    );
  }, [mutate]);

  // Memoized, and every handler with it. Rebuilt inline, this object made every
  // consumer of the cart re-render whenever anything in the provider changed -
  // including the sidebar's open flag, which nothing outside the sidebar cares
  // about.
  const value = useMemo(
    () => ({
      isOpen,
      cartItems,
      unavailable,
      loading,
      failed,
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
      unavailable,
      loading,
      failed,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      toggleCartSideBar,
      openCartSideBar,
      closeCartSideBar,
    ],
  );

  return (
    <CartSideBarContext.Provider value={value}>{children}</CartSideBarContext.Provider>
  );
}
