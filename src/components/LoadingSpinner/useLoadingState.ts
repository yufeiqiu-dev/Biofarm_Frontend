import { useEffect, useRef, useState } from "react";

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

/**
 * Whether a loading state should be on screen right now.
 *
 * This owns all the timing, and callers gate on its answer rather than on their
 * own `loading` flag - swapping in the content the moment a request resolves is
 * exactly what the minimum exists to prevent, so the decision has to sit in one
 * place and cover the content too, not just the spinner.
 *
 *   a 25ms load    - never shows anything
 *   a 300ms load   - shows at 250ms, stays until 1250ms
 *   a 3s load      - shows at 250ms, goes when the load does
 */
export function useLoadingState(
  active: boolean,
  delayMs: number = LOADING_INDICATOR_DELAY_MS,
  minimumMs: number = LOADING_INDICATOR_MINIMUM_MS,
): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      // Already on screen - a second request starting during the hold keeps the
      // indicator up rather than restarting it, so it cannot blink between two
      // loads.
      if (shown) return;

      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }

    // The load finished. If nothing was ever shown, there is nothing to hold.
    if (!shown) return;

    const elapsed = Date.now() - (shownAt.current ?? Date.now());
    const remaining = Math.max(0, minimumMs - elapsed);

    const timer = setTimeout(() => {
      shownAt.current = null;
      setShown(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, shown, delayMs, minimumMs]);

  return shown;
}
