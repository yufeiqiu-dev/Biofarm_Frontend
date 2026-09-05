import { LoadingSpinner } from "./LoadingSpinner";
import { useDelayedVisible } from "./useDelayedVisible";
import styles from "./PageLoading.module.css";

type PageLoadingProps = {
  label?: string;
  /**
   * Reserve a section's worth of height rather than a page's - for a block
   * loading inside an already-rendered page, like the featured products on the
   * home page below the hero.
   */
  compact?: boolean;
};

/**
 * The loading state for a page that is fetching its own first payload.
 *
 * Deliberately not LoadingOverlay. That component is a modal scrim - fixed,
 * full-viewport, above the navbar - which is the right shape for "this is
 * saving, do not touch anything" and the wrong shape here: during a page's
 * first fetch there is nothing underneath worth dimming, because the page has
 * not rendered yet. All the scrim did was paint the window dark for the
 * duration of the request.
 *
 * This sits in the page's own flow instead, reserves enough height that the
 * footer does not ride up and snap back when content lands, and stays empty
 * unless the load is slow enough to be worth reporting.
 */
export function PageLoading({ label, compact = false }: PageLoadingProps) {
  const visible = useDelayedVisible(true);

  return (
    <div
      className={compact ? `${styles.region} ${styles.compact}` : styles.region}
      aria-busy="true"
    >
      {visible && <LoadingSpinner label={label} />}
    </div>
  );
}
