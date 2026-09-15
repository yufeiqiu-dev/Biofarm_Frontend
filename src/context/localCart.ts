import type { AddToCartItem } from "../types/cart_types";
import type { CartLineResponse } from "../api/cart";

/**
 * The basket, local-first.
 *
 * localStorage is the working copy: every edit lands here immediately and
 * renders instantly, with no request in the direct path. The server holds a
 * synced copy, updated at a handful of points (see CartSideBarContext) rather
 * than on every keystroke - full reasoning in
 * Biofarm_KnowledgeBase/documentation/designs/2026-09-08-local-first-cart-sync.md.
 *
 * Deliberately pure. Every function here is storage-in, array-out (or the
 * reverse), so the interesting logic - the merge rule in particular - can be
 * tested without a DOM, a timer, or a mock fetch.
 */

/**
 * One line of the local basket.
 *
 * `clientUpdatedAt` is this device's own clock at the moment of the edit - the
 * thing conflicts are resolved by. `deletedAt` set means the customer removed
 * this line; it is kept as a tombstone rather than dropped outright, for the
 * same reason the server keeps one: without it there is no way to tell "this
 * was deleted" from "this device never heard of it," and a merge would
 * resurrect it.
 *
 * Carries display fields (name, price, image) that the server-side line does
 * not, because rendering here is synchronous and local - there is no request to
 * join against the catalogue on every render. That is a deliberate trade: the
 * price shown can be a little stale between sync points (sign-in, opening the
 * cart page), but checkout always re-prices from the catalogue server-side, so
 * nothing is ever charged based on what is stored here.
 */
export interface StoredCartLine {
  variantId: string;
  productId: string;
  name: string;
  imageUrl: string;
  catalogNumber: string;
  sizeLabel: string;
  unitPrice: number;
  quantity: number;
  clientUpdatedAt: string;
  deletedAt?: string;
  /** Last known stock, refreshed only at a pull point. */
  available?: number;
  overStock?: boolean;
}

function storageKey(ownerId: string): string {
  return `cart:${ownerId}`;
}

/** The key a signed-out visitor's basket is kept under. One key, not one per
 * anonymous visitor - a guest has no identity to key on, and nothing here is
 * ever uploaded, so there is nothing to keep separate. */
export const GUEST_OWNER_ID = "guest";

/** Read a basket, tolerating anything storage might hold. */
export function loadLocalCart(ownerId: string): StoredCartLine[] {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON, or a browser that denies storage access outright (private
    // mode, blocked site data). An empty basket is the honest answer to both.
    return [];
  }
}

export function saveLocalCart(ownerId: string, lines: StoredCartLine[]): void {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(lines));
  } catch {
    // Storage full or denied. The basket still works for the rest of this
    // session; it just will not survive a reload, which is no worse than not
    // having this feature at all.
  }
}

export function clearLocalCart(ownerId: string): void {
  try {
    localStorage.removeItem(storageKey(ownerId));
  } catch {
    // Nothing to do about a denial; there is nothing left to act on either way.
  }
}

/** The lines worth showing. Tombstones exist for merges, not for rendering. */
export function liveLines(lines: StoredCartLine[]): StoredCartLine[] {
  return lines.filter((line) => !line.deletedAt);
}

/** Mirrors the backend's MAX_LINE_QUANTITY (app/services/cart_service.py). The
 * server clamps a push to this; clamping here too keeps the local basket from
 * showing - and re-pushing - a value the server will never store. */
export const MAX_LINE_QUANTITY = 999;

/**
 * Set one line to an absolute quantity, stamped with the current moment.
 *
 * Absolute, not additive - "set this line to 3" is what a quantity control
 * means, and it is what the merge rule is built around: two writes to the same
 * line compare whole states, not deltas. The quantity is clamped to
 * MAX_LINE_QUANTITY, matching the server; a caller wanting zero means a
 * tombstone and should use tombstoneLocalLine.
 */
export function upsertLocalLine(
  lines: StoredCartLine[],
  item: AddToCartItem,
  quantity: number,
  now: Date = new Date(),
): StoredCartLine[] {
  quantity = Math.min(quantity, MAX_LINE_QUANTITY);
  const clientUpdatedAt = now.toISOString();
  const existingIndex = lines.findIndex((line) => line.variantId === item.variantId);
  const existing = existingIndex === -1 ? undefined : lines[existingIndex];
  // Stock knowledge is carried forward from the line being replaced, and
  // `overStock` re-derived where the last known `available` allows it. Without
  // this, a +/- on an over-stock line silently cleared the "no longer
  // available" notice while the conflict was still unresolved - the customer's
  // next signal was a 400 at the Review step. A brand-new line has no stock
  // knowledge until the next pull.
  const available = existing?.available;
  const line: StoredCartLine = {
    variantId: item.variantId,
    productId: item.productId,
    name: item.name,
    imageUrl: item.imageUrl,
    catalogNumber: item.catalogNumber,
    sizeLabel: item.sizeLabel,
    unitPrice: item.unitPrice,
    quantity,
    clientUpdatedAt,
    available,
    overStock: available !== undefined ? quantity > available : existing?.overStock,
  };

  if (existingIndex === -1) return [...lines, line];
  const next = [...lines];
  next[existingIndex] = line;
  return next;
}

/** Tombstone one line. A no-op if it is not there (or already gone), matching
 * the backend's own idempotent removal. */
export function tombstoneLocalLine(
  lines: StoredCartLine[],
  variantId: string,
  now: Date = new Date(),
): StoredCartLine[] {
  const index = lines.findIndex((line) => line.variantId === variantId && !line.deletedAt);
  if (index === -1) return lines;
  const clientUpdatedAt = now.toISOString();
  const next = [...lines];
  next[index] = { ...next[index], deletedAt: clientUpdatedAt, clientUpdatedAt };
  return next;
}

/** Tombstone every live line at once - the customer emptying the basket.
 * Returns the same array when there is nothing live to tombstone, so
 * clearing an already-empty basket is a genuine no-op (no dirty flag, no
 * push) - matching tombstoneLocalLine. */
export function tombstoneAll(lines: StoredCartLine[], now: Date = new Date()): StoredCartLine[] {
  if (lines.every((line) => line.deletedAt)) return lines;
  const clientUpdatedAt = now.toISOString();
  return lines.map((line) =>
    line.deletedAt ? line : { ...line, deletedAt: clientUpdatedAt, clientUpdatedAt },
  );
}

/**
 * Union two baskets, newer line wins per variant.
 *
 * Nothing is dropped just because one side does not mention it - unlike the
 * reconciliation a push to the server does, this runs entirely between two
 * local snapshots (a guest basket merging into a freshly signed-in account, or
 * this device's leftover basket merging against what was just pulled from the
 * server), and both sides are genuine content. A variant only `a` knows about
 * and a variant only `b` knows about both survive; a variant both know about
 * keeps whichever has the later `clientUpdatedAt`, tombstone or not - a tie
 * keeps `a`, matching the server's own tie-break, so two devices whose clocks
 * happen to agree do not keep re-writing each other's identical line forever.
 *
 * Compared numerically (Date.parse), not as strings: a locally-generated
 * `toISOString()` and a pydantic-serialized timestamp pulled from the server
 * are not guaranteed to share a format, and string comparison of differently
 * formatted ISO timestamps is not reliably correct.
 */
export function mergeUnion(a: StoredCartLine[], b: StoredCartLine[]): StoredCartLine[] {
  const byVariant = new Map<string, StoredCartLine>();
  for (const line of a) byVariant.set(line.variantId, line);
  for (const line of b) {
    const existing = byVariant.get(line.variantId);
    if (!existing || Date.parse(line.clientUpdatedAt) > Date.parse(existing.clientUpdatedAt)) {
      byVariant.set(line.variantId, line);
    }
  }
  return [...byVariant.values()];
}

/**
 * A server-reported tombstone, as a StoredCartLine `mergeUnion` can weigh
 * against a local copy of the same variant.
 *
 * Carries no display data on purpose: a tombstone is filtered out by
 * `liveLines` before anything renders, and a later revival through
 * `upsertLocalLine` rebuilds the line from the catalogue regardless. The
 * quantity is a placeholder the server's `CHECK (quantity > 0)` is happy with.
 */
export function tombstoneFromServer(entry: {
  variant_id: string;
  client_updated_at: string;
}): StoredCartLine {
  return {
    variantId: entry.variant_id,
    productId: "",
    name: "",
    imageUrl: "",
    catalogNumber: "",
    sizeLabel: "",
    unitPrice: 0,
    quantity: 1,
    clientUpdatedAt: entry.client_updated_at,
    deletedAt: entry.client_updated_at,
  };
}

/** How long a tombstone is worth keeping locally. Mirrors the backend's
 * TOMBSTONE_MAX_AGE_DAYS (app/services/cart_service.py) - past that the server
 * has likely swept its own row, so a local tombstone could not win a merge
 * against anything and only grows storage and every push payload. */
export const TOMBSTONE_MAX_AGE_DAYS = 90;

/**
 * Drop tombstones older than the retention window. Live lines are never
 * touched. Applied after a merge, before saving, so neither localStorage nor
 * the next sync payload carries an unbounded history of every variant ever
 * added and removed.
 */
export function pruneTombstones(
  lines: StoredCartLine[],
  now: Date = new Date(),
  maxAgeDays: number = TOMBSTONE_MAX_AGE_DAYS,
): StoredCartLine[] {
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return lines.filter(
    (line) => !line.deletedAt || Date.parse(line.deletedAt) >= cutoff,
  );
}

/** A pulled server line, translated into the local storage shape. */
export function fromServerLine(line: CartLineResponse): StoredCartLine {
  return {
    variantId: line.variant_id,
    productId: line.product_id,
    name: line.name,
    imageUrl: line.image_url,
    catalogNumber: line.catalog_number,
    sizeLabel: line.size_label,
    unitPrice: line.unit_price,
    quantity: line.quantity,
    clientUpdatedAt: line.client_updated_at,
    available: line.available,
    overStock: line.over_stock,
  };
}

/** Every line - live and tombstoned - as the sync payload the server expects. */
export function toSyncPayload(lines: StoredCartLine[]): {
  variant_id: string;
  quantity: number;
  client_updated_at: string;
  deleted: boolean;
}[] {
  return lines.map((line) => ({
    variant_id: line.variantId,
    // The server's CHECK (quantity > 0) applies to a tombstone too - the last
    // live quantity is kept rather than zeroed, which is also what makes
    // "revive this line" a meaningful edit rather than starting from nothing.
    quantity: line.quantity,
    client_updated_at: line.clientUpdatedAt,
    deleted: Boolean(line.deletedAt),
  }));
}
