import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductImages } from './useProductImages';

/*
 * Arbitrary-position reordering, which is what dragging needs where the arrows
 * only step by one. Both end in the same array, so a drag and an arrow press
 * are one operation with different arithmetic - there is no second ordering
 * implementation to drift out of step.
 */
describe('useProductImages reorder', () => {
  function setup(urls: string[]) {
    const hook = renderHook(() => useProductImages(vi.fn()));
    act(() => hook.result.current.reset(urls));
    return hook;
  }

  it('moves an image to an arbitrary position, not just one step', async () => {
    const { result } = setup(['a', 'b', 'c', 'd']);

    act(() => result.current.reorder(0, 3));

    expect(result.current.displayedUrls).toEqual(['b', 'c', 'd', 'a']);
  });

  it('moves backwards as well as forwards', async () => {
    const { result } = setup(['a', 'b', 'c', 'd']);

    act(() => result.current.reorder(3, 0));

    expect(result.current.displayedUrls).toEqual(['d', 'a', 'b', 'c']);
  });

  it('makes the first image primary, since position is what primary means', async () => {
    // image_urls[0] is the display image, so a drag to the front is a promotion.
    const { result } = setup(['a', 'b', 'c']);

    act(() => result.current.reorder(2, 0));

    expect(result.current.displayedUrls[0]).toBe('c');
  });

  it('ignores a move that goes nowhere', async () => {
    const { result } = setup(['a', 'b', 'c']);
    const before = result.current.displayedUrls;

    act(() => result.current.reorder(1, 1));

    expect(result.current.displayedUrls).toBe(before);
  });

  it('ignores an index outside the list', async () => {
    // A pointer that leaves the grid mid-drag must not corrupt the order.
    const { result } = setup(['a', 'b', 'c']);

    act(() => result.current.reorder(0, 9));
    act(() => result.current.reorder(-1, 1));

    expect(result.current.displayedUrls).toEqual(['a', 'b', 'c']);
  });

  it('reorders images chosen but not yet uploaded', async () => {
    // These had no ordering at all: a fresh batch could only be arranged by
    // saving it first and rearranging afterwards.
    const { result } = setup([]);
    const files = [
      new File(['1'], 'one.png', { type: 'image/png' }),
      new File(['2'], 'two.png', { type: 'image/png' }),
      new File(['3'], 'three.png', { type: 'image/png' }),
    ];
    act(() => result.current.select(files));
    expect(result.current.pendingFiles.map((p) => p.file.name)).toEqual([
      'one.png',
      'two.png',
      'three.png',
    ]);

    act(() => result.current.reorderPending(2, 0));

    expect(result.current.pendingFiles.map((p) => p.file.name)).toEqual([
      'three.png',
      'one.png',
      'two.png',
    ]);
  });

  it('does not disturb saved images when pending ones are reordered', async () => {
    const { result } = setup(['a', 'b']);
    act(() =>
      result.current.select([
        new File(['1'], 'one.png', { type: 'image/png' }),
        new File(['2'], 'two.png', { type: 'image/png' }),
      ]),
    );

    act(() => result.current.reorderPending(1, 0));

    expect(result.current.displayedUrls).toEqual(['a', 'b']);
  });
});
