import { LoadingSpinner } from "./LoadingSpinner";
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
 * Presentational only. When it is on screen is decided by useLoadingState,
 * because that decision has to gate the content as well - a page that swaps in
 * its cards the instant the request resolves would defeat the minimum hold no
 * matter what this component did.
 */
export function PageLoading({ label, compact = false }: PageLoadingProps) {
  return (
    <div
      className={compact ? `${styles.region} ${styles.compact}` : styles.region}
      aria-busy="true"
    >
      <LoadingSpinner label={label} />
    </div>
  );
}
