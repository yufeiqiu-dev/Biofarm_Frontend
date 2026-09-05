import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PageLoading } from './PageLoading';
import { LoadingOverlay } from './LoadingOverlay';
import { LOADING_INDICATOR_DELAY_MS } from './useDelayedVisible';

/**
 * The bug these hold the line on: every page rendered its loading state as
 * LoadingOverlay - a fixed, full-viewport rgba(15,23,42,0.18) scrim at z-index
 * 2500, above the navbar. Against a local backend the fetch resolves in ~25ms,
 * so clicking any nav link painted the whole window dark for 25ms and then
 * showed the page. Measured in the browser, not inferred: one full-screen dark
 * element, visible for 25ms, on /products but not on /about.
 */
describe('loading indicators', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('PageLoading', () => {
    it('shows nothing at all when the load is faster than the delay', () => {
      // The whole point. A spinner visible for 25ms is not information, it is
      // a flash, and it is what made navigation feel broken.
      render(<PageLoading />);

      act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 1); });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    it('shows the spinner once the load is slow enough to be worth reporting', () => {
      render(<PageLoading />);

      act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('reserves height so the footer does not jump when content arrives', () => {
      // Without this the page is momentarily empty, the sticky footer rides up
      // the viewport, and the layout snaps when the products land.
      const { container } = render(<PageLoading />);
      const region = container.firstElementChild;

      expect(region).not.toBeNull();
      expect(region!.className).not.toBe('');
    });
  });

  describe('LoadingOverlay', () => {
    it('does not flash its scrim for an operation that finishes quickly', () => {
      // Still the right component for a blocking save, which is slow enough to
      // need one - but not for anything that might finish in 25ms.
      const { rerender } = render(<LoadingOverlay visible={true} />);

      act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 1); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      rerender(<LoadingOverlay visible={false} />);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('appears for an operation that actually takes time', () => {
      render(<LoadingOverlay visible={true} label="Saving..." />);

      act(() => { vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS); });

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});
