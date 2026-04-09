import styles from "./LoadingSpinner.module.css";

type LoadingSpinnerProps = {
  label?: string;
};

export function LoadingSpinner({ label = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <div className={styles.spinner} />
      <p className={styles.label}>{label}</p>
    </div>
  );
}