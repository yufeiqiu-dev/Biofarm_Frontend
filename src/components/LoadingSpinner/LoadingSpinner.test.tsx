import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { PageLoading } from './PageLoading';
import { LoadingOverlay } from './LoadingOverlay';
import {
  useLoadingState,
  LOADING_INDICATOR_DELAY_MS,
  LOADING_INDICATOR_MINIMUM_MS,
} from './useLoadingState';

/**
 * Two rules, pulling in opposite directions, and both were reported from the
 * screen rather than theorised.
 *
 * A loading state that appears for 25ms is not information, it is a flash - the
 * whole window went dark on every navigation because a blocking scrim was used
 * as a page loading state. So nothing appears for the first quarter second.
 *
 * And once something has appeared, whipping it away a frame later is the same
 * flash in the other direction. So it stays for a second before it can go.
 */
describe('useLoadingState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing for a load that finishes inside the delay', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 50); });
    rerender({ active: false });

    expect(result.current.visible).toBe(false);

    // And it must not appear afterwards either - the load is already over.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.visible).toBe(false);
  });

  it('appears once the load outlasts the delay', () => {
    const { result } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    expect(result.current.visible).toBe(false);
    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });
    expect(result.current.visible).toBe(true);
  });

  it('stays for the full minimum even when the load ends immediately after', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });
    expect(result.current.visible).toBe(true);

    // The response lands one millisecond later.
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.visible).toBe(true);

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_MINIMUM_MS - 100); });
    expect(result.current.visible).toBe(true);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.visible).toBe(false);
  });

  it('does not extend a load that already ran longer than the minimum', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS + LOADING_INDICATOR_MINIMUM_MS + 500); });
    expect(result.current.visible).toBe(true);

    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(0); });

    expect(result.current.visible).toBe(false);
  });

  it('keeps showing when a second load starts while the first is still held', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(100); });

    // A filter click starts another request during the hold.
    rerender({ active: true });
    act(() => { vi.advanceTimersByTime(50); });

    // It must not blink off and back on again.
    expect(result.current.visible).toBe(true);
  });
});

describe('PageLoading', () => {
  it('renders the spinner it is given, leaving the timing to useLoadingState', () => {
    render(<PageLoading label="Loading products..." />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading products...')).toBeInTheDocument();
  });

  it('reserves height so the footer does not ride up while it waits', () => {
    // The page collapsed below the height of the window during a load, and the
    // dark footer rode up onto the screen - 240px of a 962px viewport.
    const { container } = render(<PageLoading />);
    const region = container.firstElementChild;

    expect(region).not.toBeNull();
    expect(region!.className).not.toBe('');
  });
});

describe('LoadingOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not flash its scrim for an operation that finishes quickly', () => {
    const { rerender } = render(<LoadingOverlay visible={true} />);

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 50); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<LoadingOverlay visible={false} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('holds the scrim for the minimum once a save has shown one', () => {
    const { rerender } = render(<LoadingOverlay visible={true} label="Saving..." />);

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    rerender(<LoadingOverlay visible={false} label="Saving..." />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_MINIMUM_MS); });
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });
});

describe('useLoadingState reserving space', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is pending from the very first frame, before the spinner is due', () => {
    // The regression this exists to stop. While the spinner was gated behind
    // the delay, pages rendered their *empty* state for the first 250ms - "No
    // products found." on the listing, an empty grid on the home page - so the
    // page collapsed and the dark footer rode up. Measured per animation frame:
    // one frame at 54% of the viewport dark on the way to the home page.
    const { result } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    expect(result.current.pending).toBe(true);
    expect(result.current.visible).toBe(false);
  });

  it('stays pending through the minimum hold after the load ends', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current.pending).toBe(true);

    act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_MINIMUM_MS); });
    expect(result.current.pending).toBe(false);
  });

  it('stops being pending as soon as a fast load ends, having shown nothing', () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingState(active), {
      initialProps: { active: true },
    });

    act(() => { vi.advanceTimersByTime(50); });
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(0); });

    expect(result.current.pending).toBe(false);
    expect(result.current.visible).toBe(false);
  });
});
