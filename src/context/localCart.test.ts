import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadLocalCart,
  saveLocalCart,
  clearLocalCart,
  liveLines,
  upsertLocalLine,
  tombstoneLocalLine,
  tombstoneAll,
  mergeUnion,
  fromServerLine,
  tombstoneFromServer,
  pruneTombstones,
  toSyncPayload,
  type StoredCartLine,
} from './localCart';
import type { AddToCartItem } from '../types/cart_types';

function item(overrides: Partial<AddToCartItem> = {}): AddToCartItem {
  return {
    productId: 'p1',
    variantId: 'v1',
    name: 'Anti-Tau',
    imageUrl: 'x.jpg',
    catalogNumber: 'AB-101',
    sizeLabel: '50ug',
    unitPrice: 285,
    quantity: 1,
    ...overrides,
  };
}

function line(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    variantId: 'v1',
    productId: 'p1',
    name: 'Anti-Tau',
    imageUrl: 'x.jpg',
    catalogNumber: 'AB-101',
    sizeLabel: '50ug',
    unitPrice: 285,
    quantity: 1,
    clientUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('localStorage read/write', () => {
  beforeEach(() => localStorage.clear());

  it('reads back what was saved', () => {
    saveLocalCart('u1', [line()]);
    expect(loadLocalCart('u1')).toEqual([line()]);
  });

  it('answers empty for a key that was never written', () => {
    expect(loadLocalCart('nobody')).toEqual([]);
  });

  it('tolerates corrupt JSON rather than throwing', () => {
    localStorage.setItem('cart:u1', 'not json{{{');
    expect(loadLocalCart('u1')).toEqual([]);
  });

  it('tolerates a value that parses but is not an array', () => {
    localStorage.setItem('cart:u1', JSON.stringify({ not: 'an array' }));
    expect(loadLocalCart('u1')).toEqual([]);
  });

  it('keeps different owners apart', () => {
    saveLocalCart('u1', [line({ variantId: 'v1' })]);
    saveLocalCart('u2', [line({ variantId: 'v2' })]);

    expect(loadLocalCart('u1')[0].variantId).toBe('v1');
    expect(loadLocalCart('u2')[0].variantId).toBe('v2');
  });

  it('clears just the one owner', () => {
    saveLocalCart('u1', [line()]);
    saveLocalCart('u2', [line()]);

    clearLocalCart('u1');

    expect(loadLocalCart('u1')).toEqual([]);
    expect(loadLocalCart('u2')).toHaveLength(1);
  });
});

describe('liveLines', () => {
  it('drops tombstones', () => {
    const lines = [line({ variantId: 'v1' }), line({ variantId: 'v2', deletedAt: '2026-01-02T00:00:00.000Z' })];

    expect(liveLines(lines).map((l) => l.variantId)).toEqual(['v1']);
  });
});

describe('upsertLocalLine', () => {
  it('adds a new line stamped with the given moment', () => {
    const now = new Date('2026-03-01T10:00:00.000Z');
    const lines = upsertLocalLine([], item(), 2, now);

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].clientUpdatedAt).toBe(now.toISOString());
  });

  it('replaces an existing line by variant rather than duplicating it', () => {
    const first = upsertLocalLine([], item(), 1, new Date('2026-01-01T00:00:00.000Z'));
    const second = upsertLocalLine(first, item(), 5, new Date('2026-01-02T00:00:00.000Z'));

    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(5);
  });

  it('revives a tombstoned line rather than adding a second row', () => {
    const deleted = tombstoneLocalLine(
      upsertLocalLine([], item(), 1, new Date('2026-01-01T00:00:00.000Z')),
      'v1',
      new Date('2026-01-02T00:00:00.000Z'),
    );

    const revived = upsertLocalLine(deleted, item(), 3, new Date('2026-01-03T00:00:00.000Z'));

    expect(revived).toHaveLength(1);
    expect(revived[0].deletedAt).toBeUndefined();
    expect(revived[0].quantity).toBe(3);
  });

  it('leaves other lines untouched', () => {
    const lines = [line({ variantId: 'other', quantity: 9 })];
    const next = upsertLocalLine(lines, item({ variantId: 'v1' }), 1, new Date());

    expect(next.find((l) => l.variantId === 'other')?.quantity).toBe(9);
  });

  it('carries the last known stock forward and re-derives overStock on a quantity change', () => {
    // A +/- must not silently clear the "no longer available" notice while the
    // conflict is unresolved - the customer's next signal was a 400 at Review.
    const lines = [line({ quantity: 5, available: 2, overStock: true })];

    const bumped = upsertLocalLine(lines, item(), 6);
    expect(bumped[0].available).toBe(2);
    expect(bumped[0].overStock).toBe(true);

    const dropped = upsertLocalLine(lines, item(), 1);
    expect(dropped[0].available).toBe(2);
    // Now within stock - re-derived locally rather than left stale at true.
    expect(dropped[0].overStock).toBe(false);
  });

  it('gives a brand-new line no stock knowledge until the next pull', () => {
    const next = upsertLocalLine([], item(), 3);
    expect(next[0].available).toBeUndefined();
    expect(next[0].overStock).toBeUndefined();
  });

  it('clamps to the server maximum, so the local cart never shows a value the server rejects', () => {
    const next = upsertLocalLine([], item(), 100000);
    expect(next[0].quantity).toBe(999);
  });
});

describe('tombstoneLocalLine', () => {
  it('marks a live line deleted and stamps the moment', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    const next = tombstoneLocalLine([line()], 'v1', now);

    expect(next[0].deletedAt).toBe(now.toISOString());
    expect(next[0].clientUpdatedAt).toBe(now.toISOString());
    // The quantity is not zeroed - the server's CHECK (quantity > 0) forbids
    // it, and there is no reason to throw away the last known count.
    expect(next[0].quantity).toBe(1);
  });

  it('is a no-op for a line that is not there', () => {
    expect(tombstoneLocalLine([], 'nope')).toEqual([]);
  });

  it('is a no-op for a line that is already gone, and does not re-stamp it', () => {
    const already = tombstoneLocalLine([line()], 'v1', new Date('2026-01-01T00:00:00.000Z'));

    const again = tombstoneLocalLine(already, 'v1', new Date('2026-06-01T00:00:00.000Z'));

    expect(again[0].deletedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('tombstoneAll', () => {
  it('deletes every live line and leaves existing tombstones alone', () => {
    const already = tombstoneLocalLine(
      [line({ variantId: 'v1' }), line({ variantId: 'v2' })],
      'v1',
      new Date('2026-01-01T00:00:00.000Z'),
    );

    const now = new Date('2026-06-01T00:00:00.000Z');
    const all = tombstoneAll(already, now);

    expect(all.every((l) => l.deletedAt)).toBe(true);
    // v1 was already deleted earlier - not re-stamped to "now".
    expect(all.find((l) => l.variantId === 'v1')?.deletedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(all.find((l) => l.variantId === 'v2')?.deletedAt).toBe(now.toISOString());
  });
});

/*
 * mergeUnion is where the whole design's correctness lives - the same rule
 * that has to survive a phone offline in a subway tunnel, per the design doc.
 */
describe('mergeUnion', () => {
  it('is a union: a variant only one side knows about survives', () => {
    const a = [line({ variantId: 'v1' })];
    const b = [line({ variantId: 'v2' })];

    const merged = mergeUnion(a, b);

    expect(merged.map((l) => l.variantId).sort()).toEqual(['v1', 'v2']);
  });

  it('a newer line in b overwrites an older one in a', () => {
    const a = [line({ quantity: 1, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];
    const b = [line({ quantity: 9, clientUpdatedAt: '2026-01-02T00:00:00.000Z' })];

    expect(mergeUnion(a, b)[0].quantity).toBe(9);
  });

  it('an older line in b does not overwrite a newer one in a', () => {
    const a = [line({ quantity: 9, clientUpdatedAt: '2026-01-02T00:00:00.000Z' })];
    const b = [line({ quantity: 1, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];

    expect(mergeUnion(a, b)[0].quantity).toBe(9);
  });

  it('a tie keeps a, matching the server tie-break', () => {
    const a = [line({ quantity: 3, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];
    const b = [line({ quantity: 7, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];

    expect(mergeUnion(a, b)[0].quantity).toBe(3);
  });

  it('a newer tombstone in b beats a live line in a', () => {
    const a = [line({ quantity: 2, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];
    const b = [line({ quantity: 2, clientUpdatedAt: '2026-01-02T00:00:00.000Z', deletedAt: '2026-01-02T00:00:00.000Z' })];

    expect(liveLines(mergeUnion(a, b))).toEqual([]);
  });

  it('a stale tombstone in b does not resurrect-delete a newer live line in a', () => {
    // The exact subway-tunnel scenario: a device tombstones something, then a
    // separately-synced (newer) live edit for the same variant has to win.
    const a = [line({ quantity: 5, clientUpdatedAt: '2026-01-03T00:00:00.000Z' })];
    const b = [line({ quantity: 1, clientUpdatedAt: '2026-01-01T00:00:00.000Z', deletedAt: '2026-01-01T00:00:00.000Z' })];

    expect(liveLines(mergeUnion(a, b))[0].quantity).toBe(5);
  });

  it('compares timestamps numerically, not as strings, so differing formats still order correctly', () => {
    /*
     * A real, verified case, not a hypothetical one: pydantic drops the
     * fractional part entirely when a datetime lands on an exact second,
     * serialising it as "...T00:00:00Z" with no ".000000" at all - while the
     * browser's toISOString() always pads to exactly three fractional digits.
     * Lexicographically, "...00Z" sorts AFTER "...00.001Z" (comparing byte by
     * byte, 'Z' > '.'), which reads a moment one millisecond EARLIER as later.
     * Date.parse() has no such trap.
     */
    const a = [line({ quantity: 1, clientUpdatedAt: '2026-01-01T00:00:00Z' })];
    const b = [line({ quantity: 9, clientUpdatedAt: '2026-01-01T00:00:00.001Z' })];

    expect(mergeUnion(a, b)[0].quantity).toBe(9);
  });

  it('is commutative on disjoint input, so caller order does not matter for the union half', () => {
    const a = [line({ variantId: 'v1' })];
    const b = [line({ variantId: 'v2' })];

    expect(mergeUnion(a, b).map((l) => l.variantId).sort()).toEqual(
      mergeUnion(b, a).map((l) => l.variantId).sort(),
    );
  });
});

describe('fromServerLine / toSyncPayload', () => {
  it('round-trips a server line into local storage shape', () => {
    const stored = fromServerLine({
      variant_id: 'v1',
      product_id: 'p1',
      name: 'Anti-Tau',
      catalog_number: 'AB-101',
      size_label: '50ug',
      image_url: 'x.jpg',
      unit_price: 285,
      quantity: 2,
      available: 5,
      over_stock: false,
      client_updated_at: '2026-01-01T00:00:00Z',
    });

    expect(stored.variantId).toBe('v1');
    expect(stored.quantity).toBe(2);
    expect(stored.available).toBe(5);
  });

  it('carries deleted lines through as deleted: true, quantity intact', () => {
    const payload = toSyncPayload([
      line({ variantId: 'v1', quantity: 4 }),
      line({ variantId: 'v2', quantity: 3, deletedAt: '2026-01-02T00:00:00.000Z' }),
    ]);

    const deleted = payload.find((p) => p.variant_id === 'v2');
    expect(deleted?.deleted).toBe(true);
    expect(deleted?.quantity).toBe(3);

    const live = payload.find((p) => p.variant_id === 'v1');
    expect(live?.deleted).toBe(false);
  });
});

describe('tombstoneFromServer', () => {
  it('is a tombstone mergeUnion can weigh against a local live copy', () => {
    const serverTombstone = tombstoneFromServer({
      variant_id: 'v1',
      client_updated_at: '2026-02-01T00:00:00.000Z',
    });
    const localLive = [line({ variantId: 'v1', quantity: 3, clientUpdatedAt: '2026-01-01T00:00:00.000Z' })];

    // The server's deletion is newer, so it wins and the line is gone.
    expect(liveLines(mergeUnion(localLive, [serverTombstone]))).toEqual([]);
  });

  it('does not beat a local edit that is newer than the deletion', () => {
    const serverTombstone = tombstoneFromServer({
      variant_id: 'v1',
      client_updated_at: '2026-01-01T00:00:00.000Z',
    });
    const localLive = [line({ variantId: 'v1', quantity: 3, clientUpdatedAt: '2026-03-01T00:00:00.000Z' })];

    expect(liveLines(mergeUnion(localLive, [serverTombstone]))[0].quantity).toBe(3);
  });
});

describe('pruneTombstones', () => {
  it('drops tombstones older than the retention window', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const lines = [
      line({ variantId: 'live' }),
      line({ variantId: 'recent', deletedAt: '2026-05-15T00:00:00.000Z' }),
      line({ variantId: 'ancient', deletedAt: '2025-01-01T00:00:00.000Z' }),
    ];

    const kept = pruneTombstones(lines, now).map((l) => l.variantId);

    expect(kept).toEqual(['live', 'recent']);
  });

  it('never drops a live line, however old', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const lines = [line({ variantId: 'v1', clientUpdatedAt: '2000-01-01T00:00:00.000Z' })];

    expect(pruneTombstones(lines, now)).toHaveLength(1);
  });
});
