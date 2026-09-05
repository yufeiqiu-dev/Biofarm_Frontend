import { LoadingSpinner } from "./LoadingSpinner";
import { useLoadingState } from "./useLoadingState";
import styles from "./LoadingOverlay.module.css";

type LoadingOverlayProps = {
  visible: boolean;
  label?: string;
};

/**
 * A blocking scrim, for an operation the user must not interrupt - saving a
 * product, which uploads to S3, or deleting one.
 *
 * Not for page loads. It covers the whole viewport including the navbar, so
 * using it while a page fetches its first payload dimmed the entire window for
 * the length of the request; against a local backend that is about 25ms, and
 * the only thing anyone saw was a dark flash on every navigation. Pages use
 * PageLoading instead.
 *
 * The delay is kept here too, so a save that happens to be fast shows nothing
 * rather than flashing the scrim for a frame.
 */
export function LoadingOverlay({
  visible,
  label = "Loading...",
}: LoadingOverlayProps) {
  const show = useLoadingState(visible);

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <LoadingSpinner label={label} />
      </div>
    </div>
  );
}