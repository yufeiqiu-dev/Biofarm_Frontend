import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/useAuth";
import { getCart, syncCart } from "../api/cart";
import {
  GUEST_OWNER_ID,
  clearLocalCart,
  fromServerLine,
  liveLines,
  loadLocalCart,
  mergeUnion,
  pruneTombstones,
  saveLocalCart,
  tombstoneAll,
  tombstoneFromServer,
  tombstoneLocalLine,
  toSyncPayload,
  upsertLocalLine,
  type StoredCartLine,
} from "./localCart";
import type { AddToCartItem, CartItem } from "../types/cart_types";
import { CartSideBarContext } from "./useCartSideBar";

/*
 * The basket, local-first.
 *
 * localStorage is the working copy: every edit lands there synchronously and
 * is on screen immediately, with no request anywhere in that path. The server
 * holds a copy that is brought into sync at a handful of points instead of on
 * every click - a pause in editing, the tab hiding or closing, and signing in.
 * Full reasoning, including why a per-line clock and not a per-basket flag:
 * Biofarm_KnowledgeBase/documentation/designs/2026-09-08-local-first-cart-sync.md
 *
 * Signing out is handled outside this file, in AuthContext.signOut - it
 * flushes this device's basket and clears its localStorage itself, before
 * Amplify's own sign-out redirects the page away (taking every bit of this
 * component's state with it). By the time this provider next mounts, the
 * owner is already `guest`.
 *
 * A push's response is never written back into what is on screen - it is
 * fire-and-forget from the editor's point of view. Only the two pull points -
 * signing in, and opening the cart page - merge the server's copy in, via
 * mergeUnion. Two tabs open on the same account therefore do not see each
 * other's edits until one of them pulls; the design doc accepts that as
 * "last flush wins" between tabs, which is the trade a local-first basket
 * makes deliberately.
 */

/** A pause this long with no further edit is what triggers a push - every
 * edit restarts the wait, so this is "quiet for half a second," not "half a
 * second after the first click." */
const SYNC_DEBOUNCE_MS = 500;

/** Stable empty references, so a memo keyed on them does not see a new
 * identity every render just because there is nothing in it. */
const NO_LINES: StoredCartLine[] = [];

interface ReconcileResult {
  merged: StoredCartLine[];
  /** True when the merge kept a line the server did not send - something this
   * device needs to push. False on the common "nothing has changed" pull. */
  needsPush: boolean;
}

function lineId(productId: string, variantId: string) {
  return `${productId}-${variantId}`;
}

function toCartItems(lines: StoredCartLine[]): CartItem[] {
  return liveLines(lines).map((line) => ({
    id: lineId(line.productId, line.variantId),
    productId: line.productId,
    variantId: line.variantId,
    name: line.name,
    imageUrl: line.imageUrl,
    catalogNumber: line.catalogNumber,
    sizeLabel: line.sizeLabel,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    available: line.available,
    overStock: line.overStock,
  }));
}

export function CartSideBarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ownerId = user?.user_id ?? GUEST_OWNER_ID;

  const [isOpen, setIsOpen] = useState(false);

  // Seeded synchronously from localStorage, so the first paint already shows
  // whatever this device last knew - no loading state to gate on, because
  // there is no request between mount and that first paint.
  const [state, setState] = useState<{ owner: string; lines: StoredCartLine[] }>(() => ({
    owner: ownerId,
    lines: loadLocalCart(ownerId),
  }));

  // Falls back to empty rather than showing a previous owner's basket for a
  // frame - relevant mainly to tests that swap the signed-in user without a
  // full remount; a real sign-in/out is a full-page redirect, so this repo's
  // production code never actually observes ownerId changing under a mounted
  // provider.
  const lines = state.owner === ownerId ? state.lines : NO_LINES;
  const cartItems = useMemo(() => toCartItems(lines), [lines]);
  const unavailable = useMemo(
    () => liveLines(lines).filter((line) => line.overStock).map((line) => line.catalogNumber),
    [lines],
  );

  /*
   * Whether there is an edit the server has not seen yet. Set by every
   * mutation, cleared by a push that actually lands - so a tab that is only
   * ever looked at, never edited, does not resend an unchanged basket on
   * every visibility flip.
   */
  const dirtyRef = useRef(false);
  /*
   * The latest basket and owner, readable outside of React's render cycle -
   * by the debounce timer, the pagehide/visibilitychange listeners, and by a
   * second edit landing in the same tick as the first (see applyEdit, which
   * updates this synchronously rather than waiting for the effect below).
   */
  const linesRef = useRef(lines);
  const ownerIdRef = useRef(ownerId);
  useEffect(() => {
    linesRef.current = lines;
    ownerIdRef.current = ownerId;
  }, [lines, ownerId]);

  // Deduped only for the read. A full load landing on /cart or /checkout while
  // signed in fires the provider's own reconcile effect and that page's
  // refreshCart in the same tick; sharing one GET /cart is a clean win with no
  // downside. The write is deliberately NOT coalesced this way - an in-flight
  // guard there strands an edit that lands while a slow push is running, since
  // nothing re-triggers the debounce for it. Concurrent PUTs are safe: the
  // server merges per line under a row lock, so an extra idempotent request is
  // waste, not wrongness.
  const pullInFlightRef = useRef<Promise<ReconcileResult> | null>(null);

  /**
   * Push this device's whole basket for reconciliation. Guests never call the
   * API at all - there is nothing on the server for a basket that was never
   * uploaded - and an already-clean basket is skipped rather than resent.
   *
   * Errors are swallowed deliberately: localStorage already holds the truth,
   * so a failed push loses nothing, only delays when the server catches up.
   * The next debounce, tab-hide, or sign-in pull tries again.
   */
  const flush = useCallback((opts: { keepalive?: boolean } = {}): Promise<void> => {
    if (ownerIdRef.current === GUEST_OWNER_ID) return Promise.resolve();
    if (!dirtyRef.current) return Promise.resolve();

    const snapshot = linesRef.current;
    return syncCart(toSyncPayload(snapshot), opts)
      .then(() => {
        // Only if nothing changed while the request was in flight. An edit
        // that landed mid-request is not in what was just sent, and clearing
        // the flag would strand it until the next unrelated edit.
        if (linesRef.current === snapshot) dirtyRef.current = false;
      })
      .catch(() => {
        // Best effort - see the docstring above.
      });
  }, []);

  // Debounce: every change to `lines` restarts the wait, so a burst of clicks
  // produces one push after the last of them, not one per click.
  useEffect(() => {
    if (ownerId === GUEST_OWNER_ID) return;
    const timer = window.setTimeout(() => { void flush(); }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [ownerId, lines, flush]);

  /*
   * Tab hide / close. `visibilitychange` -> hidden is the one that actually
   * works: it fires first in almost every flow - switching tabs, minimising,
   * navigating away - while the page is still fully alive, so the ordinary
   * request (auth token lookup included) completes.
   *
   * `pagehide` is a best-effort backstop only, and known to be leaky: even
   * with `keepalive`, apiRequest awaits the Amplify session before it calls
   * fetch, and that async prelude often does not finish during a hard unload -
   * so an edit made in the last moment before closing the tab, with no
   * preceding visibilitychange, can be lost. The design doc accepts this: the
   * ~500ms idle debounce is what the basket really relies on, and it is
   * reached constantly.
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => { void flush({ keepalive: true }); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flush]);

  /*
   * The read half of pull-and-merge: this device's basket for `owner`, any
   * basket left behind by browsing as a guest, and the server's copy -
   * unioned together with the newest `clientUpdatedAt` per line winning
   * (localCart.mergeUnion). Deliberately setState-free - see where this is
   * called from for why.
   *
   * `needsPush` says whether the merge kept anything the server did not send:
   * a local or guest line newer than the server's copy, or one it never had.
   * When it did not - the common "opened the cart, nothing has changed" case -
   * the caller skips the PUT entirely. A failed read cannot tell, so it
   * assumes yes: a pending local edit must still get out.
   */
  const computeReconciled = useCallback(async (owner: string): Promise<ReconcileResult> => {
    let merged = loadLocalCart(owner);
    const guest = loadLocalCart(GUEST_OWNER_ID);
    if (guest.length > 0) merged = mergeUnion(merged, guest);

    let serverLines: StoredCartLine[] = [];
    let serverRead = false;
    try {
      const server = await getCart();
      // Tombstones merged alongside live lines. A variant the server has
      // deleted is simply absent from `items`, which a union merge reads as
      // "this side never heard of it" and keeps - so a deletion made on
      // another device would be silently undone here and pushed back. Folding
      // the tombstone in lets its clock win the comparison, exactly as
      // merge_cart resolves it server-side.
      serverLines = [
        ...server.items.map(fromServerLine),
        ...(server.deleted_lines ?? []).map(tombstoneFromServer),
      ];
      serverRead = true;
    } catch {
      // The server basket could not be read. Proceed with what this device
      // already has, rather than block a pull point on a request that may
      // never come back.
    }

    // Drop tombstones past the retention window so neither storage nor the
    // next push payload carries an unbounded add-then-remove history.
    merged = pruneTombstones(mergeUnion(merged, serverLines));

    const serverByVariant = new Map(serverLines.map((line) => [line.variantId, line]));
    const needsPush =
      !serverRead ||
      merged.some((line) => {
        const onServer = serverByVariant.get(line.variantId);
        return (
          !onServer ||
          Date.parse(onServer.clientUpdatedAt) !== Date.parse(line.clientUpdatedAt)
        );
      });

    return { merged, needsPush };
  }, []);

  /** Reconcile, deduped: concurrent callers in the same tick share one
   * GET /cart rather than each firing their own. */
  const pullMerged = useCallback((owner: string): Promise<ReconcileResult> => {
    if (pullInFlightRef.current) return pullInFlightRef.current;
    const done = computeReconciled(owner).finally(() => {
      pullInFlightRef.current = null;
    });
    pullInFlightRef.current = done;
    return done;
  }, [computeReconciled]);

  /*
   * Runs whenever a real identity is established. Because signing in is a
   * full-page redirect through Cognito's hosted UI, that means this fires
   * once per mount for a signed-in visitor - equally on a genuine sign-in and
   * on a plain reload while already signed in. Treating those alike is
   * deliberate: both are "the last point this device could have missed
   * something," and the reconciliation is cheap and idempotent either way.
   *
   * The setState lives inside the `.then()` here rather than in a named
   * function called directly from the effect body - awaiting a fetch before
   * setting state is exactly what an effect is for, but written as an
   * `async`/`await` helper called straight from the effect it reads as a
   * synchronous derivation, which is the shape the mount of every other
   * server-backed page in this app avoids for the same reason.
   */
  useEffect(() => {
    if (ownerId === GUEST_OWNER_ID) return;
    let cancelled = false;

    pullMerged(ownerId).then(({ merged, needsPush }) => {
      if (cancelled) return;
      saveLocalCart(ownerId, merged);
      clearLocalCart(GUEST_OWNER_ID);
      linesRef.current = merged;
      ownerIdRef.current = ownerId;
      if (needsPush) dirtyRef.current = true;
      setState({ owner: ownerId, lines: merged });
      void flush();
    });

    return () => {
      cancelled = true;
    };
  }, [ownerId, pullMerged, flush]);

  /** Exposed for the cart page's own pull point - opening it re-reconciles
   * rather than trusting whatever this device happened to have on mount. A
   * no-op for a guest: there is nothing on the server to pull. */
  const refreshCart = useCallback((): Promise<void> => {
    if (ownerId === GUEST_OWNER_ID) return Promise.resolve();

    return pullMerged(ownerId).then(({ merged, needsPush }) => {
      saveLocalCart(ownerId, merged);
      clearLocalCart(GUEST_OWNER_ID);
      linesRef.current = merged;
      ownerIdRef.current = ownerId;
      if (needsPush) dirtyRef.current = true;
      setState({ owner: ownerId, lines: merged });
      return flush();
    });
  }, [ownerId, pullMerged, flush]);

  const toggleCartSideBar = useCallback(() => setIsOpen((prev) => !prev), []);
  const openCartSideBar = useCallback(() => setIsOpen(true), []);
  const closeCartSideBar = useCallback(() => setIsOpen(false), []);

  /*
   * Every mutation goes through here. `linesRef.current` is read rather than
   * the `lines` render value, and written back synchronously rather than
   * waiting for the sync effect above - which is what lets two edits landing
   * in the same tick (a double click on "+") each see the other's result
   * instead of both computing from the same stale quantity.
   */
  const applyEdit = useCallback(
    (compute: (current: StoredCartLine[]) => StoredCartLine[]) => {
      const current = linesRef.current;
      const next = compute(current);
      if (next === current) return;
      saveLocalCart(ownerId, next);
      dirtyRef.current = true;
      linesRef.current = next;
      setState({ owner: ownerId, lines: next });
    },
    [ownerId],
  );

  const addToCart = useCallback(
    (item: AddToCartItem) => {
      applyEdit((current) => {
        // Deduped by variantId, not productId: two sizes of the same product
        // are two distinct lines.
        const existing = liveLines(current).find((line) => line.variantId === item.variantId);
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        return upsertLocalLine(current, item, quantity);
      });
    },
    [applyEdit],
  );

  const removeFromCart = useCallback(
    (itemId: string) => {
      applyEdit((current) => {
        const target = liveLines(current).find(
          (line) => lineId(line.productId, line.variantId) === itemId,
        );
        if (!target) return current;
        return tombstoneLocalLine(current, target.variantId);
      });
    },
    [applyEdit],
  );

  const setQuantity = useCallback(
    (itemId: string, next: (current: number) => number) => {
      applyEdit((current) => {
        const target = liveLines(current).find(
          (line) => lineId(line.productId, line.variantId) === itemId,
        );
        if (!target) return current;
        const quantity = next(target.quantity);
        // Quantity zero is a line that should not be there - the server's own
        // CHECK (quantity > 0) agrees - so it is a removal, not a write of 0.
        return quantity <= 0
          ? tombstoneLocalLine(current, target.variantId)
          : upsertLocalLine(current, target, quantity);
      });
    },
    [applyEdit],
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
   * Called by OrderSuccessPage once an order exists. Purely local - checkout
   * re-prices and re-validates stock from the catalogue server-side, so
   * nothing here needs to reach the server before the sale is final. This
   * still pushes (through the ordinary debounce path, not a special one),
   * both to keep other devices' baskets from showing what was just bought and
   * because a since-tombstoned line surviving as a stray local write until the
   * next edit is a real, if minor, staleness window worth closing promptly.
   */
  const clearCart = useCallback(() => {
    applyEdit((current) => tombstoneAll(current));
  }, [applyEdit]);

  // Memoized, and every handler with it, so a consumer that only reads
  // `isOpen` (the sidebar) does not re-render on every basket edit made from
  // somewhere else on the page.
  const value = useMemo(
    () => ({
      isOpen,
      cartItems,
      unavailable,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      refreshCart,
      toggleCartSideBar,
      openCartSideBar,
      closeCartSideBar,
    }),
    [
      isOpen,
      cartItems,
      unavailable,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      refreshCart,
      toggleCartSideBar,
      openCartSideBar,
      closeCartSideBar,
    ],
  );

  return (
    <CartSideBarContext.Provider value={value}>{children}</CartSideBarContext.Provider>
  );
}
