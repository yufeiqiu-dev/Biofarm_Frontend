import { useEffect, useMemo, useRef, useState } from "react";

/**
 * How long something must stay loading before it is worth telling anyone.
 *
 * Under this, an indicator makes the interface feel worse rather than better:
 * what the user perceives is a flash, not progress. Anything that resolves
 * inside a quarter of a second should simply appear to have been instant.
 */
export const LOADING_INDICATOR_DELAY_MS = 250;

/**
 * How long an indicator stays once it has appeared.
 *
 * The delay above stops a flash on the way in; this stops the same flash on the
 * way out. A spinner that appears at 251ms and vanishes at 260ms is a blink,
 * and reads as a glitch rather than as a page that loaded.
 */
export const LOADING_INDICATOR_MINIMUM_MS = 1000;

export type LoadingState = {
  /**
   * Whether the page should still be showing a loading state at all - true from
   * the first frame of the request until the end of any minimum hold.
   *
   * Separate from `visible` for a reason that cost a bug. When only visibility
   * was gated, pages rendered their *empty* state during the silent first
   * 250ms - "No products found." on the listing, an empty grid on the home page
   * - and a page with no content collapses shorter than the window, which
   * brings the dark footer up onto the screen. Measured per animation frame:
   * one frame with 54% of the viewport dark on the way to the home page.
   *
   * So the space is reserved for the whole load, and only the spinner waits.
   */
  pending: boolean;
  /** Whether the spinner itself should be drawn. */
  visible: boolean;
};

/**
 * When a loading state should be on screen, and when it should say so.
 *
 * Callers gate on this rather than on their own `loading` flag: swapping in
 * content the moment a request resolves is exactly what the minimum exists to
 * prevent, so the decision has to cover the content too, not just the spinner.
 *
 *   a 25ms load    - space reserved, nothing drawn, gone again at 25ms
 *   a 300ms load   - drawn at 250ms, stays until 1250ms
 *   a 3s load      - drawn at 250ms, goes when the load does
 */
export function useLoadingState(
  active: boolean,
  delayMs: number = LOADING_INDICATOR_DELAY_MS,
  minimumMs: number = LOADING_INDICATOR_MINIMUM_MS,
): LoadingState {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      // Already on screen - a second request starting during the hold keeps the
      // indicator up rather than restarting it, so it cannot blink between two
      // loads.
      if (visible) return;

      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }

    // The load finished. If nothing was ever drawn, there is nothing to hold.
    if (!visible) return;

    const elapsed = Date.now() - (shownAt.current ?? Date.now());
    const remaining = Math.max(0, minimumMs - elapsed);

    const timer = setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, visible, delayMs, minimumMs]);

  return useMemo(
    () => ({ pending: active || visible, visible }),
    [active, visible],
  );
}
