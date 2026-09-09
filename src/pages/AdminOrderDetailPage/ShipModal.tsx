import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import styles from "./AdminOrderDetailPage.module.css";

/**
 * Asks for a tracking number before marking an order shipped.
 *
 * Lifted out of the page for the same reason the stock dialog was: it is a
 * self-contained piece of UI with its own focus handling, escape key and scroll
 * lock, and none of that has anything to do with the order screen around it.
 */
interface ShipModalProps {
  isOpen: boolean;
  loading: boolean;
  /**
   * Whether the money is already taken. Almost always true - capture happens at
   * confirm - but an order confirmed before that rule changed carries no
   * captured_at, and for those the backend captures on *this* click. Telling
   * that admin the customer "was already charged" would be flatly wrong about
   * the one action where it matters.
   */
  alreadyCharged: boolean;
  onConfirm: (trackingNumber: string) => void;
  onCancel: () => void;
}

export function ShipModal({ isOpen, loading, alreadyCharged, onConfirm, onCancel }: ShipModalProps) {
  // Mounting the body only while open is what resets the tracking field. It
  // used to stay mounted and clear itself with a setState inside an effect,
  // which meant a render with the previous shipment's number still in it before
  // the blanking one - and a stale value briefly visible if focus arrived first.
  if (!isOpen) return null;
  return (
    <ShipModalBody
      loading={loading}
      alreadyCharged={alreadyCharged}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function ShipModalBody({
  loading,
  alreadyCharged,
  onConfirm,
  onCancel,
}: Omit<ShipModalProps, "isOpen">) {
  const [tracking, setTracking] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Portals are committed before effects run, so the input exists here. The
    // old 50ms setTimeout was working around the element not yet being in the
    // tree, and raced with anything that stole focus in the meantime.
    inputRef.current?.focus();

    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-modal-title"
      >
        <h2 id="ship-modal-title" className={styles.modalTitle}>Mark as Shipped</h2>
        <p className={styles.modalDesc}>
          Enter a tracking number so the customer can follow their shipment.{" "}
          {alreadyCharged
            ? "The customer was already charged when you confirmed this order."
            : "The customer has not been charged yet - this order predates charging at confirm, so marking it shipped charges them now."}
        </p>
        <label className={styles.modalLabel} htmlFor="tracking-input">
          Tracking Number <span className={styles.modalOptional}>(optional)</span>
        </label>
        <input
          id="tracking-input"
          ref={inputRef}
          className={styles.modalInput}
          type="text"
          placeholder="e.g. 1Z999AA10123456784"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(tracking.trim()); }}
        />
        <div className={styles.modalButtons}>
          <button className={styles.modalCancel} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={styles.modalConfirm}
            onClick={() => onConfirm(tracking.trim())}
            disabled={loading}
          >
            {loading ? "Shipping…" : "Mark Shipped"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
