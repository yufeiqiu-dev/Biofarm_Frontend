import { STEP_LABELS } from "./checkoutForms";
import styles from "./CheckoutPage.module.css";

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className={styles.steps}>
      {STEP_LABELS.map((label, i) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < STEP_LABELS.length - 1 ? "1" : "none",
          }}
        >
          <div
            className={`${styles.step} ${i === current ? styles.active : ""} ${i < current ? styles.completed : ""}`}
          >
            <div className={styles.stepNumber}>{i + 1}</div>
            <span>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={styles.stepDivider} />}
        </div>
      ))}
    </div>
  );
}
