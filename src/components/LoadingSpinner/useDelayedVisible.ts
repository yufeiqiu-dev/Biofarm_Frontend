import { useEffect, useState } from "react";

/**
 * How long something must stay loading before it is worth telling anyone.
 *
 * Under this, showing an indicator makes the interface feel worse rather than
 * better: the user perceives a flash, not progress. The usual research figure
 * for "instantaneous" is around 100ms and for "keeping the user's flow of
 * thought uninterrupted" around a second, so anything resolving inside a
 * quarter of a second should simply appear to be instant.
 */
export const LOADING_INDICATOR_DELAY_MS = 250;

/**
 * True only once `active` has been continuously true for `delayMs`.
 *
 * The reason this exists: every page returned a full-screen loading scrim while
 * its first fetch was in flight, and against a local backend that fetch takes
 * about 25 milliseconds. The result was a dark flash over the whole window on
 * every navigation - the indicator was the only thing anyone ever saw of it.
 *
 * Gating on elapsed time rather than on the request means a fast load renders
 * nothing at all, and a genuinely slow one still reports itself.
 */
export function useDelayedVisible(
  active: boolean,
  delayMs: number = LOADING_INDICATOR_DELAY_MS,
): boolean {
  const [visible, setVisible] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Resetting during render rather than in an effect. This is React's supported
  // way to adjust state when a prop changes, and it keeps the effect below free
  // of a synchronous setState - which lints as a cascading render, and would be
  // one.
  if (active !== wasActive) {
    setWasActive(active);
    setVisible(false);
  }

  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
}
