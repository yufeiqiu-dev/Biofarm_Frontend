import { useReminder } from "../../context/useReminder";
import styles from "./ReminderToast.module.css";

export function ReminderToast() {
  const { message, visible } = useReminder();

  if (!message) return null;

  return (
    <div
      className={`${styles.toast} ${visible ? styles.visible : styles.hidden}`}
      aria-live="polite"
    >
      {message}
    </div>
  );
}