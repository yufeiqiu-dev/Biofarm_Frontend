import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProductImages, MAX_IMAGES } from './useProductImages';

vi.mock('../../api/admin_product', () => ({
  getImagePresignedUrl: vi.fn(),
  confirmImageUpload: vi.fn(),
  deleteImage: vi.fn(),
}));

function file(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  // jsdom has no object URLs.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((f: File) => `blob:${(f as File).name}`),
    revokeObjectURL: vi.fn(),
  });
});

describe('choosing files', () => {
  it('accepts several at once', () => {
    // The picker allows a multi-select; taking only the first meant six images
    // were six trips through the file dialog.
    const { result } = renderHook(() => useProductImages(vi.fn()));

    act(() => result.current.select([file('a.jpg'), file('b.png'), file('c.webp')]));

    expect(result.current.pendingFiles).toHaveLength(3);
  });

  it('keeps the good ones and complains once about the rest', () => {
    const showReminder = vi.fn();
    const { result } = renderHook(() => useProductImages(showReminder));

    act(() => result.current.select([file('a.jpg'), file('notes.pdf'), file('b.png')]));

    expect(result.current.pendingFiles).toHaveLength(2);
    expect(showReminder).toHaveBeenCalledTimes(1);
  });

  it('cannot be walked past the limit by one multi-select', () => {
    // The trap: pendingFiles does not update until the batch finishes, so
    // checking its length per file would let every file through.
    const showReminder = vi.fn();
    const { result } = renderHook(() => useProductImages(showReminder));

    act(() => result.current.select(Array.from({ length: MAX_IMAGES + 5 }, (_, i) => file(`${i}.jpg`))));

    expect(result.current.pendingFiles).toHaveLength(MAX_IMAGES);
    expect(result.current.atLimit).toBe(true);
  });
});

describe('ordering', () => {
  const urls = ['a', 'b', 'c'];

  it('moves an image one place later', () => {
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.move(0, 1));

    expect(result.current.displayedUrls).toEqual(['b', 'a', 'c']);
  });

  it('moves an image one place earlier', () => {
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.move(2, -1));

    expect(result.current.displayedUrls).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move past either end', () => {
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.move(0, -1));
    act(() => result.current.move(2, 1));

    expect(result.current.displayedUrls).toEqual(urls);
  });

  it('can reach an order that promoting alone makes awkward', () => {
    // ['a','b','c'] -> ['b','c','a'] is the case "set as primary" handles
    // badly: it can only ever move something to the front.
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.move(0, 1));
    act(() => result.current.move(1, 1));

    expect(result.current.displayedUrls).toEqual(['b', 'c', 'a']);
  });

  it('still promotes to primary in one step', () => {
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.makePrimary(2));

    expect(result.current.displayedUrls).toEqual(['c', 'a', 'b']);
  });

  it('counts what is staged for deletion without sending anything', () => {
    const { result } = renderHook(() => useProductImages(vi.fn()));
    act(() => result.current.reset(urls));

    act(() => result.current.stageDeletion(1));

    expect(result.current.displayedUrls).toEqual(['a', 'c']);
    expect(result.current.pendingDeletionCount).toBe(1);
  });
});
