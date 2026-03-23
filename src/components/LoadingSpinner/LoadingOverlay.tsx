import { LoadingSpinner } from "./LoadingSpinner";
import styles from "./LoadingOverlay.module.css";

type LoadingOverlayProps = {
  visible: boolean;
  label?: string;
};

export function LoadingOverlay({
  visible,
  label = "Loading...",
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <LoadingSpinner label={label} />
      </div>
    </div>
  );
}